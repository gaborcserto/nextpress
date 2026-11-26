import { spawnSync } from "node:child_process";
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { disposableDatabaseName } from "./disposable-database";
import { verifyDisposableDatabase } from "./docker-database";

const url = process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
let db: typeof import("@nextpress/db/src/client").prisma;
let fence: typeof import("../services/legacy-backfill/legacy-backfill-fence.server");
let persistence: typeof import("../services/legacy-backfill/legacy-backfill-persistence.server");
let backfill: typeof import("../services/legacy-backfill/legacy-content-backfill.server");
let execution: typeof import("../services/legacy-backfill/legacy-backfill-execution.server");
let writerOwnership: typeof import("../services/legacy-writer-ownership.server");
const prefix = "b053-";

async function seed(name: string) {
  return db.page.create({
    data: {
      id: prefix + name,
      type: "PAGE",
      title: "Original",
      slug: prefix + name,
      content: "Retained public bytes",
      status: "PUBLISHED",
      publishedAt: new Date("2020-01-01T00:00:00Z"),
    },
  });
}

async function connect() {
  const client = new Client({ connectionString: url });
  await client.connect();

  return client;
}

async function waitForBlockedGate() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const [row] = await db.$queryRaw<
      { waiting: boolean }[]
    >`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND database = (SELECT oid FROM pg_database WHERE datname = current_database())) AS waiting`;

    if (row?.waiting) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error("Expected a database-blocked coordination attempt");
}

describe.skipIf(!url)("database-enforced legacy backfill coordination", () => {
  beforeAll(async () => {
    const name = disposableDatabaseName(
      url,
      process.env.DATABASE_URL,
      "content",
    );
    const candidate = (await import("@nextpress/db/src/client")).prisma;
    await verifyDisposableDatabase(name, candidate);
    db = candidate;
    fence =
      await import("../services/legacy-backfill/legacy-backfill-fence.server");
    persistence =
      await import("../services/legacy-backfill/legacy-backfill-persistence.server");
    backfill =
      await import("../services/legacy-backfill/legacy-content-backfill.server");
    execution =
      await import("../services/legacy-backfill/legacy-backfill-execution.server");
    writerOwnership =
      await import("../services/legacy-writer-ownership.server");
  });

  afterAll(async () => {
    if (db) {
      await db.$disconnect();
    }
  });

  it("executes bounded deterministic batches and resumes from durable page checkpoints", async () => {
    const pages = await Promise.all([
      seed("execution-c"),
      seed("execution-a"),
      seed("execution-b"),
    ]);
    const options = { pageIds: pages.map((page) => page.id), batchSize: 1 };
    const before = await db.contentRevision.count();
    const preview = await execution.inspectLegacyExecution(db, options);
    expect(preview.every((row) => !row.completed && !row.blocked)).toBe(true);
    expect(await db.contentRevision.count()).toBe(before);
    const ownership = await fence.acquireBackfillOwnership(db);

    try {
      const first = await execution.executeLegacyBatches(
        db,
        ownership,
        options,
      );
      expect(first).toMatchObject({ remaining: 2, complete: false });
      expect(first.results[0]?.pageId).toBe(prefix + "execution-a");
      const next = await execution.executeLegacyBatches(db, ownership, {
        ...options,
        maxBatches: 2,
      });
      expect(next).toMatchObject({ remaining: 0, complete: true });
      expect(
        await execution.executeLegacyBatches(db, ownership, options),
      ).toEqual({ results: [], remaining: 0, complete: true });
      expect(
        await db.contentMigrationCheckpoint.count({
          where: { pageId: { in: options.pageIds } },
        }),
      ).toBe(3);
    } finally {
      await fence.releaseBackfillOwnership(db, ownership);
    }
  });

  it("runs the operator CLI against the verified disposable database", async () => {
    const page = await seed("cli");
    const directory = mkdtempSync(join(tmpdir(), "nextpress-backfill-cli-"));
    const cohortPath = join(directory, "cohort.json");
    const tokenPath = join(directory, "token.json");
    const ownership = await fence.acquireBackfillOwnership(db);
    writeFileSync(
      cohortPath,
      JSON.stringify({ pageIds: [page.id], batchSize: 1 }),
    );
    writeFileSync(
      tokenPath,
      JSON.stringify({
        ...ownership,
        generation: ownership.generation.toString(),
      }),
    );

    try {
      for (const mode of ["dry-run", "execute"] as const) {
        const result = spawnSync(
          process.execPath,
          [
            "--conditions=react-server",
            "--import",
            "tsx",
            "scripts/legacy-backfill.ts",
            mode,
            cohortPath,
            tokenPath,
          ],
          {
            env: { ...process.env, NODE_ENV: "development" },
            encoding: "utf8",
            timeout: 20000,
          },
        );
        const diagnostic =
          result.stderr?.match(
            /BACKFILL_[A-Z_]+|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|SyntaxError|DATABASE_URL is not set/,
          )?.[0] ?? "UNKNOWN_CLI_BOOTSTRAP_FAILURE";
        expect(result.status, diagnostic).toBe(0);
        expect(result.stderr).toBe("");
        expect(result.stdout).not.toContain(page.content);

        if (mode === "execute") {
          expect(JSON.parse(result.stdout)).toMatchObject({
            complete: true,
            remaining: 0,
          });
        }
      }

      expect(
        await db.contentRevision.count({ where: { pageId: page.id } }),
      ).toBe(1);
    } finally {
      await fence.releaseBackfillOwnership(db, ownership);
      unlinkSync(cohortPath);
      unlinkSync(tokenPath);
      rmdirSync(directory);
    }
  }, 30000);

  it("rejects stale checkpoints before advancing another batch", async () => {
    const first = await seed("checkpoint-a");
    const second = await seed("checkpoint-b");
    const options = { pageIds: [first.id, second.id], batchSize: 1 };
    const ownership = await fence.acquireBackfillOwnership(db);
    await execution.executeLegacyBatches(db, ownership, options);
    await fence.releaseBackfillOwnership(db, ownership);
    await db.page.update({
      where: { id: first.id },
      data: { title: "Legacy still owns SHADOW" },
    });
    const resumed = await fence.acquireBackfillOwnership(db);

    try {
      await expect(
        execution.executeLegacyBatches(db, resumed, options),
      ).rejects.toMatchObject({ code: "BACKFILL_PREFLIGHT_CONFLICT" });
      expect(
        await db.contentRevision.count({ where: { pageId: second.id } }),
      ).toBe(0);
    } finally {
      await fence.releaseBackfillOwnership(db, resumed);
    }
  });

  it("recovers an interrupted execution without duplicating earlier page commits", async () => {
    const first = await seed("interrupted-a");
    const second = await seed("interrupted-b");
    const options = { pageIds: [first.id, second.id], batchSize: 2 };
    const ownership = await fence.acquireBackfillOwnership(db);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION b054_interrupt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."pageId"='b053-interrupted-b' THEN RAISE EXCEPTION 'synthetic interruption'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER b054_interrupt BEFORE INSERT ON "ContentMigrationCheckpoint" FOR EACH ROW EXECUTE FUNCTION b054_interrupt()',
    );

    try {
      await expect(
        execution.executeLegacyBatches(db, ownership, options),
      ).rejects.toMatchObject({ code: "BACKFILL_DATABASE_FAILURE" });
      expect(
        await db.contentMigrationCheckpoint.count({
          where: { pageId: first.id },
        }),
      ).toBe(1);
      expect(
        await db.contentRevision.count({ where: { pageId: second.id } }),
      ).toBe(0);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER b054_interrupt ON "ContentMigrationCheckpoint"',
      );
      await db.$executeRawUnsafe("DROP FUNCTION b054_interrupt()");
    }

    try {
      const result = await execution.executeLegacyBatches(
        db,
        ownership,
        options,
      );
      expect(result.complete).toBe(true);
      expect(result.results).toEqual([{ pageId: second.id, state: "created" }]);
      expect(
        await db.contentRevision.count({ where: { pageId: first.id } }),
      ).toBe(1);
    } finally {
      await fence.releaseBackfillOwnership(db, ownership);
    }
  });

  it("refuses an expired worker and resumes with a new generation after takeover", async () => {
    const page = await seed("execution-takeover");
    const ownership = await fence.acquireBackfillOwnership(db);
    await db.$executeRaw`UPDATE "LegacyBackfillFence" SET "expiresAt"=clock_timestamp()-interval '1 second' WHERE id=1`;
    const options = { pageIds: [page.id] };
    await expect(
      execution.executeLegacyBatches(db, ownership, options),
    ).rejects.toMatchObject({ code: "BACKFILL_OWNERSHIP_LOST" });
    const next = await fence.acquireBackfillOwnership(db);

    try {
      await expect(
        execution.executeLegacyBatches(db, ownership, options),
      ).rejects.toMatchObject({ code: "BACKFILL_OWNERSHIP_LOST" });
      expect(
        await execution.executeLegacyBatches(db, next, options),
      ).toMatchObject({ complete: true });
      expect(next.generation).toBeGreaterThan(ownership.generation);
    } finally {
      await fence.releaseBackfillOwnership(db, next);
    }
  });

  it("holds the fence when final cohort parity detects a concurrent editorial mutation", async () => {
    const first = await seed("final-parity-a");
    const second = await seed("final-parity-b");
    const ownership = await fence.acquireBackfillOwnership(db);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION b054_tamper() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."pageId"='b053-final-parity-b' THEN PERFORM pg_advisory_xact_lock(71520260504::bigint); END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER b054_tamper BEFORE INSERT ON "ContentMigrationCheckpoint" FOR EACH ROW EXECUTE FUNCTION b054_tamper()',
    );
    const client = await connect();
    await client.query("SELECT pg_advisory_lock(71520260504::bigint)");
    const writing = execution.executeLegacyBatches(db, ownership, {
      pageIds: [first.id, second.id],
      batchSize: 2,
    });
    const observedWrite = writing.catch((error: unknown) => error);

    try {
      await waitForBlockedGate();
      await client.query(
        'UPDATE "ContentDraft" SET "draftVersion"=1 WHERE "pageId"=$1',
        [first.id],
      );
      await client.query("SELECT pg_advisory_unlock(71520260504::bigint)");
      await expect(writing).rejects.toMatchObject({
        code: "BACKFILL_FINAL_PARITY_FAILED",
      });
      expect(
        await db.contentMigrationCheckpoint.count({
          where: { pageId: { in: [first.id, second.id] } },
        }),
      ).toBe(2);
      await expect(
        client.query("UPDATE \"Page\" SET title='stale' WHERE id=$1", [
          first.id,
        ]),
      ).rejects.toMatchObject({ code: "P5501" });
    } finally {
      await client.query("SELECT pg_advisory_unlock(71520260504::bigint)");
      await observedWrite;
      await client.end();
      await db.$executeRawUnsafe(
        'DROP TRIGGER b054_tamper ON "ContentMigrationCheckpoint"',
      );
      await db.$executeRawUnsafe("DROP FUNCTION b054_tamper()");
      await fence.releaseBackfillOwnership(db, ownership);
    }
  });

  it("rejects invalid execution limits before database work", async () => {
    await expect(
      execution.executeLegacyBatches(
        db,
        { owner: "invalid", generation: 0n },
        { pageIds: ["unused"], batchSize: 101 },
      ),
    ).rejects.toMatchObject({ name: "ZodError" });
    await expect(
      execution.inspectLegacyExecution(db, { pageIds: [] }),
    ).rejects.toMatchObject({ name: "ZodError" });
  });

  it("seals ownership without altering public projections and safely returns it to legacy", async () => {
    const page = await seed("sealed");
    let ownership = await fence.acquireBackfillOwnership(db);
    await persistence.persistFencedLegacyPage(db, page.id, ownership);
    await writerOwnership.transitionLegacyOwnership(
      db,
      ownership,
      page.id,
      "READY",
    );
    await fence.releaseBackfillOwnership(db, ownership);
    const client = await connect();

    try {
      await expect(
        client.query("UPDATE \"Page\" SET slug=$1,status='DRAFT' WHERE id=$2", [
          "stale",
          page.id,
        ]),
      ).rejects.toMatchObject({ code: "P5503" });
      await expect(
        client.query('DELETE FROM "PageOnTaxonomy"'),
      ).rejects.toMatchObject({ code: "P5503" });
      await expect(
        client.query('UPDATE "PageMedia" SET sort=sort+1'),
      ).rejects.toMatchObject({ code: "P5503" });
      expect(await db.page.findUnique({ where: { id: page.id } })).toEqual(
        page,
      );
    } finally {
      await client.end();
      ownership = await fence.acquireBackfillOwnership(db);
      await writerOwnership.transitionLegacyOwnership(
        db,
        ownership,
        page.id,
        "SHADOW",
      );
      await fence.releaseBackfillOwnership(db, ownership);
    }

    await db.page.update({
      where: { id: page.id },
      data: { title: "Legacy resumed" },
    });
  });

  it("refuses ownership transfer after editorial mutation and retains READY on failed return", async () => {
    const page = await seed("return-conflict");
    const ownership = await fence.acquireBackfillOwnership(db);

    try {
      await persistence.persistFencedLegacyPage(db, page.id, ownership);
      await writerOwnership.transitionLegacyOwnership(
        db,
        ownership,
        page.id,
        "READY",
      );
      await db.contentDraft.update({
        where: { pageId: page.id },
        data: { draftVersion: 1 },
      });
      await expect(
        writerOwnership.transitionLegacyOwnership(
          db,
          ownership,
          page.id,
          "SHADOW",
        ),
      ).rejects.toMatchObject({ code: "OWNERSHIP_PARITY_REQUIRED" });
      expect(
        (
          await db.contentEditorialState.findUniqueOrThrow({
            where: { pageId: page.id },
          })
        ).enrollmentState,
      ).toBe("READY");
    } finally {
      await db.contentDraft.update({
        where: { pageId: page.id },
        data: { draftVersion: 0 },
      });
      await writerOwnership.transitionLegacyOwnership(
        db,
        ownership,
        page.id,
        "SHADOW",
      );
      await fence.releaseBackfillOwnership(db, ownership);
    }
  });

  it("fails preflight on missing migration history, disabled triggers and absent write privileges", async () => {
    await execution.preflightLegacyExecution(db);
    await db.$executeRaw`UPDATE "_prisma_migrations" SET rolled_back_at=now() WHERE migration_name='20261116160000_legacy_writer_ownership'`;

    try {
      await expect(
        execution.preflightLegacyExecution(db),
      ).rejects.toMatchObject({ code: "BACKFILL_PREFLIGHT_FAILED" });
    } finally {
      await db.$executeRaw`UPDATE "_prisma_migrations" SET rolled_back_at=NULL WHERE migration_name='20261116160000_legacy_writer_ownership'`;
    }

    await db.$executeRawUnsafe(
      'ALTER TABLE "PageMedia" DISABLE TRIGGER legacy_backfill_guard',
    );

    try {
      await expect(
        execution.preflightLegacyExecution(db),
      ).rejects.toMatchObject({ code: "BACKFILL_PREFLIGHT_FAILED" });
    } finally {
      await db.$executeRawUnsafe(
        'ALTER TABLE "PageMedia" ENABLE ALWAYS TRIGGER legacy_backfill_guard',
      );
    }

    await db.$executeRawUnsafe(
      'REVOKE INSERT ON "ContentDraft" FROM CURRENT_USER',
    );

    try {
      await expect(
        execution.preflightLegacyExecution(db),
      ).rejects.toMatchObject({ code: "BACKFILL_PREFLIGHT_FAILED" });
    } finally {
      await db.$executeRawUnsafe(
        'GRANT INSERT ON "ContentDraft" TO CURRENT_USER',
      );
    }
  });

  it("drains an in-flight legacy writer before capturing and preserves public data", async () => {
    const page = await seed("drain");
    const client = await connect();
    await client.query("BEGIN");
    await client.query('UPDATE "Page" SET title = $1 WHERE id = $2', [
      "Committed legacy change",
      page.id,
    ]);
    const acquiring = fence.acquireBackfillOwnership(db);

    try {
      await waitForBlockedGate();
      await client.query("COMMIT");
      const ownership = await acquiring;

      try {
        expect(
          await persistence.persistFencedLegacyPage(db, page.id, ownership),
        ).toBe("created");
        const current = await db.page.findUniqueOrThrow({
          where: { id: page.id },
        });
        expect(current).toEqual({ ...page, title: "Committed legacy change" });
        expect(
          (await backfill.reconcileLegacyContent(db)).records.find(
            (row) => row.id === page.id,
          ),
        ).toMatchObject({ issues: [] });
      } finally {
        await fence.releaseBackfillOwnership(db, ownership);
      }
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });

  it.each([
    [
      "page creation",
      "INSERT INTO \"Page\" (id,type,slug,title,content,\"updatedAt\") VALUES ('b053-new','PAGE','b053-new','new','',now())",
    ],
    [
      "scalar update",
      "UPDATE \"Page\" SET title='changed' WHERE id='b053-writers'",
    ],
    [
      "publication",
      "UPDATE \"Page\" SET status='DRAFT',\"publishedAt\"=NULL WHERE id='b053-writers'",
    ],
    ["slug", "UPDATE \"Page\" SET slug='changed' WHERE id='b053-writers'"],
    [
      "revision creation",
      "INSERT INTO \"PageRevision\" (id,\"pageId\",title,slug,content,layout,status,\"createdAt\") VALUES ('b053-r','b053-writers','t','s','','STANDARD','DRAFT',now())",
    ],
    ["revision mutation", "UPDATE \"PageRevision\" SET note='changed'"],
    ["revision deletion", 'DELETE FROM "PageRevision"'],
    ["page deletion", "DELETE FROM \"Page\" WHERE id='b053-writers'"],
    [
      "taxonomy link creation",
      'INSERT INTO "PageOnTaxonomy" ("pageId","taxonomyId") VALUES (\'b053-writers\',\'b053-tag\')',
    ],
    [
      "taxonomy link deletion",
      'DELETE FROM "PageOnTaxonomy" WHERE "pageId"=\'b053-writers\'',
    ],
    ["gallery mutation", 'UPDATE "PageMedia" SET sort=sort+1'],
    [
      "media creation",
      "INSERT INTO \"Media\" (id,url,mime) VALUES ('b053-new-media','/synthetic','image/png')",
    ],
    [
      "media update",
      "UPDATE \"Media\" SET url='/changed' WHERE id='b053-media'",
    ],
    ["media deletion", "DELETE FROM \"Media\" WHERE id='b053-media'"],
    [
      "taxonomy mutation",
      "UPDATE \"Taxonomy\" SET name='changed' WHERE id='b053-tag'",
    ],
    ["taxonomy deletion", "DELETE FROM \"Taxonomy\" WHERE id='b053-tag'"],
    ["actor deletion", "DELETE FROM \"User\" WHERE id='b053-absent'"],
    ["truncate", 'TRUNCATE "PageOnTaxonomy"'],
  ])("rejects concurrent %s using database triggers", async (_name, sql) => {
    // Statement guards intentionally fire even when a mutation matches zero rows.
    const ownership = await fence.acquireBackfillOwnership(db);
    const client = await connect();

    try {
      await expect(client.query(sql)).rejects.toMatchObject({
        code: "P5501",
        message: "BACKFILL_WRITER_HELD",
      });
    } finally {
      await client.end();
      await fence.releaseBackfillOwnership(db, ownership);
    }
  });

  it("protects targets after import and allows ordinary writers after explicit release", async () => {
    const page = await seed("references");

    const media = await db.media.create({
      data: { id: prefix + "target", url: "/synthetic", mime: "image/png" },
    });
    await db.page.update({
      where: { id: page.id },
      data: { coverId: media.id },
    });
    const ownership = await fence.acquireBackfillOwnership(db);
    const client = await connect();

    try {
      await persistence.persistFencedLegacyPage(db, page.id, ownership);
      await expect(
        client.query('DELETE FROM "Media" WHERE id=$1', [media.id]),
      ).rejects.toMatchObject({ code: "P5501" });
    } finally {
      await fence.releaseBackfillOwnership(db, ownership);
    }

    try {
      await expect(
        client.query('DELETE FROM "Media" WHERE id=$1', [media.id]),
      ).rejects.toMatchObject({ code: "23001" });
      await db.page.update({
        where: { id: page.id },
        data: { title: "Writer resumed" },
      });
      expect(
        (await backfill.reconcileLegacyContent(db)).records.find(
          (row) => row.id === page.id,
        )?.state,
      ).toBe("conflict");
    } finally {
      await client.end();
    }
  });

  it("has one durable owner and rejects stale tokens after release, expiry and takeover", async () => {
    const page = await seed("ownership");

    const outcomes = await Promise.allSettled([
      fence.acquireBackfillOwnership(db),
      fence.acquireBackfillOwnership(db),
    ]);
    expect(outcomes.filter((row) => row.status === "fulfilled")).toHaveLength(
      1,
    );
    const winner = outcomes.find((row) => row.status === "fulfilled");

    if (!winner || winner.status !== "fulfilled") {
      throw new Error("Missing owner");
    }

    const old = winner.value;
    await fence.releaseBackfillOwnership(db, old);
    const current = await fence.acquireBackfillOwnership(db);
    let cleanup = current;

    try {
      expect(current.generation).toBeGreaterThan(old.generation);
      await expect(
        persistence.persistFencedLegacyPage(db, page.id, old),
      ).rejects.toMatchObject({ code: "BACKFILL_OWNERSHIP_LOST" });
      await expect(fence.renewBackfillOwnership(db, old)).rejects.toMatchObject(
        { code: "BACKFILL_OWNERSHIP_LOST" },
      );
      await db.$executeRaw`UPDATE "LegacyBackfillFence" SET "expiresAt" = clock_timestamp() - interval '1 second' WHERE id=1`;
      await expect(
        persistence.persistFencedLegacyPage(db, page.id, current),
      ).rejects.toMatchObject({ code: "BACKFILL_OWNERSHIP_LOST" });
      const next = await fence.acquireBackfillOwnership(db);
      cleanup = next;
      expect(next.generation).toBeGreaterThan(current.generation);
      expect(await persistence.persistFencedLegacyPage(db, page.id, next)).toBe(
        "created",
      );
    } finally {
      await fence.releaseBackfillOwnership(db, cleanup);
    }
  });

  it("stops a batch after ownership loss and resumes without duplicating its committed page", async () => {
    const first = await seed("batch-first");
    const second = await seed("batch-second");
    const old = await fence.acquireBackfillOwnership(db);
    await persistence.persistFencedLegacyPage(db, first.id, old);
    await fence.releaseBackfillOwnership(db, old);
    const current = await fence.acquireBackfillOwnership(db);

    try {
      await expect(
        backfill.backfillLegacyContent({
          db,
          ownership: old,
          pageIds: [second.id],
        }),
      ).rejects.toMatchObject({ code: "BACKFILL_OWNERSHIP_LOST" });
      expect(
        await db.contentRevision.count({ where: { pageId: second.id } }),
      ).toBe(0);
      expect(
        await backfill.backfillLegacyContent({
          db,
          ownership: current,
          pageIds: [first.id, second.id],
        }),
      ).toEqual([
        { pageId: first.id, state: "existing" },
        { pageId: second.id, state: "created" },
      ]);
    } finally {
      await fence.releaseBackfillOwnership(db, current);
    }
  });

  it("rolls back on lease expiry during persistence and retains earlier batch work", async () => {
    const first = await seed("expiry-first");
    const second = await seed("expiry-second");
    const ownership = await fence.acquireBackfillOwnership(db);
    await persistence.persistFencedLegacyPage(db, first.id, ownership);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION b053_expire() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."pageId"='b053-expiry-second' THEN UPDATE "LegacyBackfillFence" SET "expiresAt"=clock_timestamp()-interval '1 second' WHERE id=1; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER b053_expire BEFORE INSERT ON "ContentMigrationCheckpoint" FOR EACH ROW EXECUTE FUNCTION b053_expire()`,
    );

    try {
      await expect(
        persistence.persistFencedLegacyPage(db, second.id, ownership),
      ).rejects.toMatchObject({ code: "BACKFILL_OWNERSHIP_LOST" });
      expect(
        await db.contentRevision.count({ where: { pageId: second.id } }),
      ).toBe(0);
      expect(
        await db.contentRevision.count({ where: { pageId: first.id } }),
      ).toBe(1);
    } finally {
      await db.$executeRawUnsafe(
        `DROP TRIGGER b053_expire ON "ContentMigrationCheckpoint"`,
      );
      await db.$executeRawUnsafe(`DROP FUNCTION b053_expire()`);
    }

    try {
      await fence.renewBackfillOwnership(db, ownership);
      expect(
        await persistence.persistFencedLegacyPage(db, second.id, ownership),
      ).toBe("created");
    } finally {
      await fence.releaseBackfillOwnership(db, ownership);
    }
  });

  it("refuses missing or disabled coordination coverage before capture", async () => {
    await db.$executeRawUnsafe(
      'ALTER TABLE "PageMedia" DISABLE TRIGGER legacy_backfill_guard',
    );

    try {
      await expect(fence.acquireBackfillOwnership(db)).rejects.toMatchObject({
        code: "BACKFILL_COORDINATION_UNAVAILABLE",
      });
    } finally {
      await db.$executeRawUnsafe(
        'ALTER TABLE "PageMedia" ENABLE ALWAYS TRIGGER legacy_backfill_guard',
      );
    }
  });

  it("returns sanitized reference integrity diagnostics and rolls back before retry", async () => {
    const page = await seed("bad-reference");

    const media = await db.media.create({
      data: {
        id: prefix + "bad-reference-media",
        url: "/synthetic",
        mime: "image/png",
      },
    });
    await db.page.update({
      where: { id: page.id },
      data: { coverId: media.id },
    });
    const ownership = await fence.acquireBackfillOwnership(db);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION b053_bad_reference() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW."mediaId"='b053-nonexistent'; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER b053_bad_reference BEFORE INSERT ON "ContentRevisionMedia" FOR EACH ROW EXECUTE FUNCTION b053_bad_reference()`,
    );

    try {
      await expect(
        persistence.persistFencedLegacyPage(db, page.id, ownership),
      ).rejects.toMatchObject({
        code: "REFERENCE_INTEGRITY_CONFLICT",
        message: "Legacy content backfill conflict",
      });
      expect(
        await db.contentRevision.count({ where: { pageId: page.id } }),
      ).toBe(0);
    } finally {
      await db.$executeRawUnsafe(
        `DROP TRIGGER b053_bad_reference ON "ContentRevisionMedia"`,
      );
      await db.$executeRawUnsafe(`DROP FUNCTION b053_bad_reference()`);
    }

    try {
      expect(
        await persistence.persistFencedLegacyPage(db, page.id, ownership),
      ).toBe("created");
    } finally {
      await fence.releaseBackfillOwnership(db, ownership);
    }
  });

  it("rejects a configured identity that disagrees with the connected cluster", async () => {
    const original = process.env.NEXTPRESS_BACKFILL_CLUSTER_ID;
    process.env.NEXTPRESS_BACKFILL_CLUSTER_ID = "1";

    try {
      await expect(fence.acquireBackfillOwnership(db)).rejects.toMatchObject({
        code: "BACKFILL_IDENTITY_MISMATCH",
      });
    } finally {
      if (original === undefined) {
        delete process.env.NEXTPRESS_BACKFILL_CLUSTER_ID;
      } else {
        process.env.NEXTPRESS_BACKFILL_CLUSTER_ID = original;
      }
    }
  });

  it("prevents ownership release from overtaking an in-flight page commit", async () => {
    const page = await seed("commit-barrier");
    const ownership = await fence.acquireBackfillOwnership(db);
    const blocker = await connect();
    await blocker.query("SELECT pg_advisory_lock(71520260504::bigint)");
    await db.$executeRawUnsafe(
      `CREATE FUNCTION b053_pause() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."pageId"='b053-commit-barrier' THEN PERFORM pg_advisory_xact_lock(71520260504::bigint); END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER b053_pause BEFORE INSERT ON "ContentMigrationCheckpoint" FOR EACH ROW EXECUTE FUNCTION b053_pause()`,
    );
    const writing = persistence.persistFencedLegacyPage(db, page.id, ownership);
    const observedWrite = writing.catch((error: unknown) => error);
    let releasing: Promise<void> | undefined;

    try {
      await waitForBlockedGate();
      releasing = fence.releaseBackfillOwnership(db, ownership);

      for (let attempt = 0; attempt < 100; attempt++) {
        const [row] = await db.$queryRaw<
          { count: number }[]
        >`SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`;

        if (row && row.count >= 2) {
          break;
        }

        if (attempt === 99) {
          throw new Error("Release did not wait for the committing worker");
        }

        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      await blocker.query("SELECT pg_advisory_unlock(71520260504::bigint)");
      expect(await writing).toBe("created");
      await releasing;
      await expect(
        persistence.persistFencedLegacyPage(db, page.id, ownership),
      ).rejects.toMatchObject({ code: "BACKFILL_OWNERSHIP_LOST" });
    } finally {
      await blocker.query("SELECT pg_advisory_unlock(71520260504::bigint)");
      await observedWrite;

      if (releasing) {
        await releasing;
      } else {
        await fence.releaseBackfillOwnership(db, ownership);
      }

      await blocker.end();
      await db.$executeRawUnsafe(
        `DROP TRIGGER b053_pause ON "ContentMigrationCheckpoint"`,
      );
      await db.$executeRawUnsafe(`DROP FUNCTION b053_pause()`);
    }
  });
});
