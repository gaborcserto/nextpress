import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { disposableDatabaseName } from "./disposable-database";
import { verifyDisposableDatabase } from "./docker-database";

const url = process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
let db: typeof import("@nextpress/db/src/client").prisma;
let fence: typeof import("../services/legacy-backfill-fence.server");
let persistence: typeof import("../services/legacy-backfill-persistence.server");
let backfill: typeof import("../services/legacy-content-backfill.server");
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
    fence = await import("../services/legacy-backfill-fence.server");
    persistence =
      await import("../services/legacy-backfill-persistence.server");
    backfill = await import("../services/legacy-content-backfill.server");
  });

  afterAll(async () => {
    if (db) {
      await db.$disconnect();
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
