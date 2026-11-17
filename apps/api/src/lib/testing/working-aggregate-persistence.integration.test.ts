import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { disposableDatabaseName } from "./disposable-database";
import { verifyDisposableDatabase } from "./docker-database";

const url = process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
let db: typeof import("@nextpress/db/src/client").prisma;
let loadDisposableWorkingAggregate: typeof import("./working-aggregate-persistence").loadDisposableWorkingAggregate;
let saveDisposableWorkingAggregate: typeof import("./working-aggregate-persistence").saveDisposableWorkingAggregate;
const actor = { id: "verification", role: "ADMIN" as const };
const prefix = `np-working-${randomUUID()}`;

async function seed(type: "PAGE" | "POST" = "PAGE") {
  return db.page.create({
    data: {
      type,
      title: "Public title",
      slug: `${prefix}-${randomUUID()}`,
      content: "Historical bytes",
      status: "PUBLISHED",
      publishedAt: new Date("2020-01-01T00:00:00Z"),
      layout: "EVENT_PAGE",
      eventLocation: "Historical location",
      inHeaderMenu: true,
    },
  });
}

async function command(pageId: string) {
  const current = await loadDisposableWorkingAggregate(db, pageId, actor);

  return {
    pageId,
    requestId: randomUUID(),
    expectedDraftVersion: current.version,
    expectedSourceVersion: current.sourceVersion,
    edit: {
      expectedVersion: current.aggregate.baseVersion,
      expectedFingerprint: current.aggregate.baseFingerprint,
      patch: { title: "Private title" },
    },
  };
}

describe.skipIf(!url)(
  "private aggregate persistence with database writer fences",
  () => {
    beforeAll(async () => {
      const name = disposableDatabaseName(
        url,
        process.env.DATABASE_URL,
        "content",
      );
      db = (await import("@nextpress/db/src/client")).prisma;
      await verifyDisposableDatabase(name, db);
      ({ loadDisposableWorkingAggregate, saveDisposableWorkingAggregate } =
        await import("./working-aggregate-persistence"));
    });

    afterAll(async () => {
      // The guarded runner owns destruction of this entire cluster, including retained history.
      await db?.$disconnect();
    });

    it("logically resets a private draft after source drift, retaining every revision and replay", async () => {
      const page = await seed();
      const original = await command(page.id);
      const saved = await saveDisposableWorkingAggregate(db, original, actor);
      await db.page.update({
        where: { id: page.id },
        data: { title: "New live source" },
      });
      const { loadWorkingAggregate } =
        await import("../services/working-aggregate-persistence.server");
      const latest = await loadWorkingAggregate(db, page.id, actor, {
        includeSourceMetadata: true,
      });
      const reset = {
        ...original,
        requestId: randomUUID(),
        operation: "RESET",
        expectedDraftVersion: latest.version,
        expectedSourceVersion: latest.currentSourceVersion,
        edit: {
          expectedVersion: latest.aggregate.baseVersion,
          expectedFingerprint: latest.aggregate.baseFingerprint,
          patch: {},
        },
      };
      const result = await saveDisposableWorkingAggregate(db, reset, actor);
      expect(result.aggregate.snapshot.fields.title).toBe("New live source");
      expect(result.version).toBe(saved.version + 1);
      expect(await saveDisposableWorkingAggregate(db, reset, actor)).toEqual(
        result,
      );
      expect(await saveDisposableWorkingAggregate(db, original, actor)).toEqual(
        saved,
      );
      expect(
        await db.nPWorkingRevision.count({ where: { pageId: page.id } }),
      ).toBe(2);
      expect(
        (await db.page.findUniqueOrThrow({ where: { id: page.id } })).title,
      ).toBe("New live source");
      await expect(
        saveDisposableWorkingAggregate(
          db,
          { ...reset, requestId: randomUUID() },
          actor,
        ),
      ).rejects.toThrow("DRAFT_VERSION_CONFLICT");
    });

    it("refuses rehearsal under the disposable harness schema-owner role", async () => {
      const { requirePrivateDraftAdmission, PrivateDraftUnavailableError } =
        await import("../services/private-draft-admission.server");
      const [privileges] = await db.$queryRaw<{ owner: boolean }[]>`
        SELECT has_schema_privilege('public', 'CREATE') AS owner`;
      expect(privileges?.owner).toBe(true);
      vi.stubEnv("NEXTPRESS_PRIVATE_DRAFT_REHEARSAL", "enabled");

      try {
        await expect(requirePrivateDraftAdmission(db)).rejects.toBeInstanceOf(
          PrivateDraftUnavailableError,
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("reconciles deterministically without enrollment, normalization or legacy mutation", async () => {
      const { reconcilePrivateDraftReadiness } =
        await import("../services/private-draft-readiness.server");
      const page = await seed();
      await saveDisposableWorkingAggregate(db, await command(page.id), actor);
      const before = {
        page: await db.page.findUnique({ where: { id: page.id } }),
        history: await db.nPWorkingRevision.count(),
        shadow: await db.contentEditorialState.count(),
      };
      const first = await reconcilePrivateDraftReadiness(db);
      expect(await reconcilePrivateDraftReadiness(db)).toEqual(first);
      expect(first.deploymentReady).toBe(false);
      expect(
        first.records.find((record) => record.id === page.id),
      ).toMatchObject({
        id: page.id,
        kind: "PAGE",
        enrollmentState: "absent",
        privateVersions: 1,
        issues: [],
      });
      expect({
        page: await db.page.findUnique({ where: { id: page.id } }),
        history: await db.nPWorkingRevision.count(),
        shadow: await db.contentEditorialState.count(),
      }).toEqual(before);
      await db.page.update({
        where: { id: page.id },
        data: { title: "Legacy update" },
      });
      const drifted = await reconcilePrivateDraftReadiness(db);
      expect(
        drifted.records.find((record) => record.id === page.id)?.issues,
      ).toContain("PRIVATE:SOURCE_DRIFT");
    });

    it.each(["PAGE", "POST"] as const)(
      "saves and reloads private %s state without changing public eligibility or source bytes",
      async (type) => {
        const page = await seed(type);
        const saved = await saveDisposableWorkingAggregate(
          db,
          await command(page.id),
          actor,
        );
        expect(saved.version).toBe(1);
        expect(saved.aggregate.snapshot.fields).toMatchObject({
          title: "Private title",
          eventLocation: "Historical location",
          inHeaderMenu: true,
        });
        expect(
          await loadDisposableWorkingAggregate(db, page.id, actor),
        ).toEqual(saved);
        expect(await db.page.findUnique({ where: { id: page.id } })).toEqual(
          page,
        );
        expect(
          await db.contentEditorialState.findUnique({
            where: { pageId: page.id },
          }),
        ).toBeNull();
      },
    );

    it("replays identical requests and rejects request ID reuse", async () => {
      const page = await seed();
      const input = await command(page.id);
      const saved = await saveDisposableWorkingAggregate(db, input, actor);
      expect(await saveDisposableWorkingAggregate(db, input, actor)).toEqual(
        saved,
      );
      await expect(
        saveDisposableWorkingAggregate(
          db,
          {
            ...input,
            edit: { ...input.edit, patch: { title: "Other title" } },
          },
          actor,
        ),
      ).rejects.toThrow("REQUEST_REUSE_CONFLICT");
    });

    it("allows only one concurrent save from a shared draft version", async () => {
      const page = await seed();
      const input = await command(page.id);
      const results = await Promise.allSettled([
        saveDisposableWorkingAggregate(db, input, actor),
        saveDisposableWorkingAggregate(
          db,
          { ...input, requestId: randomUUID() },
          actor,
        ),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        (await loadDisposableWorkingAggregate(db, page.id, actor)).version,
      ).toBe(1);
    });

    it("rejects legacy scalar drift and unversioned relationship drift", async () => {
      const page = await seed();
      const input = await command(page.id);
      await saveDisposableWorkingAggregate(db, input, actor);
      await db.page.update({
        where: { id: page.id },
        data: { title: "Legacy change" },
      });
      await expect(
        saveDisposableWorkingAggregate(
          db,
          {
            ...input,
            requestId: randomUUID(),
            expectedDraftVersion: 1,
          },
          actor,
        ),
      ).rejects.toThrow();
      const other = await seed();
      const otherInput = await command(other.id);
      await saveDisposableWorkingAggregate(db, otherInput, actor);
      const tag = await db.taxonomy.create({
        data: {
          type: "TAG",
          name: "Tag",
          slug: `${prefix}-${randomUUID()}`,
        },
      });
      await db.pageOnTaxonomy.create({
        data: { pageId: other.id, taxonomyId: tag.id },
      });
      await expect(
        saveDisposableWorkingAggregate(
          db,
          {
            ...otherInput,
            requestId: randomUUID(),
            expectedDraftVersion: 1,
          },
          actor,
        ),
      ).rejects.toThrow();
    });

    it("rejects missing or incorrectly typed tag references without appending a revision", async () => {
      const page = await seed();
      const input = await command(page.id);
      await expect(
        saveDisposableWorkingAggregate(
          db,
          {
            ...input,
            edit: { ...input.edit, patch: { tagIds: ["missing"] } },
          },
          actor,
        ),
      ).rejects.toThrow("REFERENCE_CONFLICT");
      expect(
        (await loadDisposableWorkingAggregate(db, page.id, actor)).version,
      ).toBe(0);
    });

    it("retains reference integrity after commit", async () => {
      const page = await seed();
      const tag = await db.taxonomy.create({
        data: {
          type: "TAG",
          name: "Retained",
          slug: `${prefix}-${randomUUID()}`,
        },
      });
      const input = await command(page.id);
      await saveDisposableWorkingAggregate(
        db,
        {
          ...input,
          edit: { ...input.edit, patch: { tagIds: [tag.id] } },
        },
        actor,
      );
      await expect(
        db.taxonomy.delete({ where: { id: tag.id } }),
      ).rejects.toThrow();
    });

    it("replays duplicate concurrent requests exactly once", async () => {
      const page = await seed();
      const input = await command(page.id);
      const results = await Promise.all([
        saveDisposableWorkingAggregate(db, input, actor),
        saveDisposableWorkingAggregate(db, input, actor),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(
        await db.nPWorkingRevision.count({ where: { pageId: page.id } }),
      ).toBe(1);
    });

    it("fences old writers in another process without globally blocking other content", async () => {
      const page = await seed();
      const other = await seed();
      const client = new Client({ connectionString: url });
      await client.connect();

      try {
        await client.query("BEGIN");
        await client.query(
          'SELECT version FROM "NPContentFence" WHERE "pageId" = $1 FOR UPDATE',
          [page.id],
        );
        const child = spawn(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            `
        import pg from 'pg';
        const client = new pg.Client({connectionString: process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL});
        await client.connect();
        try {
          await client.query('UPDATE "Page" SET title = $1 WHERE id = $2', ['Unsafe old writer', process.env.NP_TEST_PAGE_ID]);
          process.exitCode = 2;
        } catch (error) {
          process.stdout.write(error.code);
        } finally { await client.end(); }
      `,
          ],
          {
            env: { ...process.env, NP_TEST_PAGE_ID: page.id },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let output = "";
        child.stdout.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        const code = await new Promise<number | null>((resolve, reject) => {
          child.once("error", reject);
          child.once("exit", resolve);
        });
        expect(code).toBe(0);
        expect(output).toBe("55P03");
        await db.page.update({
          where: { id: other.id },
          data: { title: "Independent writer" },
        });
        expect(
          (await db.page.findUniqueOrThrow({ where: { id: page.id } })).title,
        ).toBe(page.title);
      } finally {
        await client.query("ROLLBACK");
        await client.end();
      }
    });

    it("rejects a reverse Page lock immediately rather than forming a deadlock", async () => {
      const page = await seed();
      const input = await command(page.id);
      const client = new Client({ connectionString: url });
      await client.connect();

      try {
        await client.query("BEGIN");
        await client.query('SELECT id FROM "Page" WHERE id = $1 FOR UPDATE', [
          page.id,
        ]);
        await expect(
          saveDisposableWorkingAggregate(db, input, actor),
        ).rejects.toThrow("TRANSACTION_RETRY_REQUIRED");
      } finally {
        await client.query("ROLLBACK");
        await client.end();
      }
      expect(
        await saveDisposableWorkingAggregate(db, input, actor),
      ).toMatchObject({ version: 1 });
    });

    it("rejects deletion held during a save and allows a retry after rollback", async () => {
      const page = await seed();
      const tag = await db.taxonomy.create({
        data: {
          type: "TAG",
          name: "Racing",
          slug: `${prefix}-${randomUUID()}`,
        },
      });
      const input = await command(page.id);
      input.edit.patch = { title: "Private title", ...{ tagIds: [tag.id] } };
      const client = new Client({ connectionString: url });
      await client.connect();

      try {
        await client.query("BEGIN");
        await client.query('DELETE FROM "Taxonomy" WHERE id = $1', [tag.id]);
        await expect(
          saveDisposableWorkingAggregate(db, input, actor),
        ).rejects.toThrow("TRANSACTION_RETRY_REQUIRED");
        expect(
          await db.nPWorkingRevision.count({ where: { pageId: page.id } }),
        ).toBe(0);
      } finally {
        await client.query("ROLLBACK");
        await client.end();
      }
      await saveDisposableWorkingAggregate(db, input, actor);
      await expect(
        db.taxonomy.update({
          where: { id: tag.id },
          data: { type: "CATEGORY" },
        }),
      ).rejects.toThrow();
    });

    it("rolls back a failure after revision insertion and reuses the uncommitted request safely", async () => {
      const page = await seed();
      const tag = await db.taxonomy.create({
        data: {
          type: "TAG",
          name: "Rollback",
          slug: `${prefix}-${randomUUID()}`,
        },
      });
      const input = await command(page.id);
      const candidate = {
        ...input,
        edit: { ...input.edit, patch: { tagIds: [tag.id] } },
      };
      await db.$executeRaw`CREATE FUNCTION np_fail_working_reference() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected reference failure'; END $$`;
      await db.$executeRaw`CREATE TRIGGER np_fail_working_reference BEFORE INSERT ON "NPWorkingTaxonomy" FOR EACH ROW EXECUTE FUNCTION np_fail_working_reference()`;

      try {
        await expect(
          saveDisposableWorkingAggregate(db, candidate, actor),
        ).rejects.toThrow();
        expect(
          await db.nPWorkingRevision.count({ where: { pageId: page.id } }),
        ).toBe(0);
        expect(await db.page.findUnique({ where: { id: page.id } })).toEqual(
          page,
        );
      } finally {
        await db.$executeRaw`DROP TRIGGER np_fail_working_reference ON "NPWorkingTaxonomy"`;
        await db.$executeRaw`DROP FUNCTION np_fail_working_reference()`;
      }
      const saved = await saveDisposableWorkingAggregate(db, candidate, actor);
      expect(saved.version).toBe(1);
      await expect(
        db.nPWorkingRevision.updateMany({
          where: { pageId: page.id },
          data: { version: 10 },
        }),
      ).rejects.toThrow();
      await expect(
        db.nPWorkingTaxonomy.deleteMany({ where: { targetId: tag.id } }),
      ).rejects.toThrow();
    });

    it("coordinates standalone tag writes and advances the legacy token", async () => {
      const { setTagsForPage } = await import("../repos/tagRepo");
      const page = await seed();
      const input = await command(page.id);
      const client = new Client({ connectionString: url });
      await client.connect();

      try {
        await client.query("BEGIN");
        await client.query(
          'SELECT version FROM "NPContentFence" WHERE "pageId" = $1 FOR UPDATE',
          [page.id],
        );
        await expect(
          setTagsForPage(page.id, [], undefined, actor),
        ).rejects.toThrow();
      } finally {
        await client.query("ROLLBACK");
        await client.end();
      }
      await setTagsForPage(page.id, [], undefined, actor);
      expect(
        (await db.page.findUniqueOrThrow({ where: { id: page.id } }))
          .workingVersion,
      ).toBe(page.workingVersion + 1);
      await expect(
        saveDisposableWorkingAggregate(db, input, actor),
      ).rejects.toThrow("SOURCE_VERSION_CONFLICT");
    });

    it("admits one revision or live update from a shared base", async () => {
      const { updatePageWithTags } = await import("../repos/pageRepo");
      const { saveRevision } = await import("../services/revisions.server");
      const page = await seed();
      const results = await Promise.allSettled([
        updatePageWithTags(
          page.id,
          { expectedVersion: 0, title: "Live edit" },
          "PAGE",
          actor,
        ),
        saveRevision(
          page.id,
          {
            expectedVersion: 0,
            title: "Revision",
            slug: page.slug,
            excerpt: "",
            content: "",
            layout: "EVENT_PAGE",
            pageDocument: null,
          },
          actor,
        ),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        (await db.page.findUniqueOrThrow({ where: { id: page.id } }))
          .workingVersion,
      ).toBe(1);
    });

    it("preserves historical fields, ordered media, raw documents and intent across repeated saves", async () => {
      const page = await seed();
      const parent = await seed();
      const category = await db.taxonomy.create({
        data: {
          type: "CATEGORY",
          name: "Historical category",
          slug: `${prefix}-${randomUUID()}`,
        },
      });
      const media = await db.media.create({
        data: { url: "/historical-media", mime: "image/png" },
      });
      const raw = '{ "version": 1, "blocks": [] }';
      await db.page.update({
        where: { id: page.id },
        data: {
          parentId: parent.id,
          listingKind: "EVENTS",
          listingTaxonomyId: category.id,
          registrationUrl: "legacy:value",
          eventStart: new Date("2019-01-01T00:00:00Z"),
          eventEnd: null,
          redirectTo: "/historical",
          coverId: media.id,
          pageDocument: raw,
          inFooterMenu: true,
        },
      });
      await db.pageOnTaxonomy.create({
        data: { pageId: page.id, taxonomyId: category.id },
      });
      await db.pageMedia.create({
        data: { pageId: page.id, mediaId: media.id, sort: 7 },
      });
      const before = await loadDisposableWorkingAggregate(db, page.id, actor);
      const first = await saveDisposableWorkingAggregate(
        db,
        {
          ...(await command(page.id)),
          edit: {
            expectedVersion: before.aggregate.baseVersion,
            expectedFingerprint: before.aggregate.baseFingerprint,
            patch: { title: "Private title" },
            publicationIntent: {
              action: "CHANGE",
              status: "DRAFT",
              publishedAt: null,
            },
          },
        },
        actor,
      );
      const second = await saveDisposableWorkingAggregate(
        db,
        await command(page.id),
        actor,
      );
      expect(second.version).toBe(2);
      expect(second.aggregate).toEqual(first.aggregate);
      expect(second.aggregate.snapshot).toEqual({
        ...before.aggregate.snapshot,
        fields: { ...before.aggregate.snapshot.fields, title: "Private title" },
      });
      expect(second.aggregate.rawPageDocument).toBe(raw);
      expect(await loadDisposableWorkingAggregate(db, page.id, actor)).toEqual(
        second,
      );
      const source = await db.page.findUniqueOrThrow({
        where: { id: page.id },
      });
      expect(source.status).toBe("PUBLISHED");
      expect(source.publishedAt).toEqual(page.publishedAt);
      expect(source.title).toBe(page.title);
      await expect(
        db.media.delete({ where: { id: media.id } }),
      ).rejects.toThrow();
    });

    it("fences gallery writes and media deletion cascades with the content token", async () => {
      const page = await seed();
      const media = await db.media.create({
        data: { url: "/gallery-media", mime: "image/png" },
      });
      await db.pageMedia.create({
        data: { pageId: page.id, mediaId: media.id, sort: 2 },
      });
      const input = await command(page.id);
      const client = new Client({ connectionString: url });
      await client.connect();

      try {
        await client.query("BEGIN");
        await client.query(
          'SELECT version FROM "NPContentFence" WHERE "pageId" = $1 FOR UPDATE',
          [page.id],
        );
        await expect(
          db.pageMedia.update({
            where: { pageId_mediaId: { pageId: page.id, mediaId: media.id } },
            data: { sort: 9 },
          }),
        ).rejects.toThrow();
        await expect(
          db.media.delete({ where: { id: media.id } }),
        ).rejects.toThrow();
      } finally {
        await client.query("ROLLBACK");
        await client.end();
      }
      await db.pageMedia.update({
        where: { pageId_mediaId: { pageId: page.id, mediaId: media.id } },
        data: { sort: 9 },
      });
      await expect(
        saveDisposableWorkingAggregate(db, input, actor),
      ).rejects.toThrow("SOURCE_VERSION_CONFLICT");
    });

    it("rejects stale fingerprints and ownership changes without leaking prior private work", async () => {
      const page = await seed();
      const input = await command(page.id);
      await expect(
        saveDisposableWorkingAggregate(
          db,
          {
            ...input,
            edit: { ...input.edit, expectedFingerprint: "0".repeat(64) },
          },
          actor,
        ),
      ).rejects.toThrow();
      await expect(
        saveDisposableWorkingAggregate(db, input, {
          id: "other",
          role: "AUTHOR",
        }),
      ).rejects.toThrow();
      expect(
        await db.nPWorkingRevision.count({ where: { pageId: page.id } }),
      ).toBe(0);
      await saveDisposableWorkingAggregate(db, input, actor);
      const user = await db.user.create({ data: { name: "New owner" } });
      await db.page.update({
        where: { id: page.id },
        data: { authorId: user.id },
      });
      await expect(
        loadDisposableWorkingAggregate(db, page.id, {
          id: user.id,
          role: "AUTHOR",
        }),
      ).rejects.toThrow("IDENTITY_CONFLICT");
      await expect(
        saveDisposableWorkingAggregate(db, input, actor),
      ).rejects.toThrow("REQUEST_REUSE_CONFLICT");
    });

    it("holds taxonomy classification stable for standalone tag assignment", async () => {
      const { setTagsForPage } = await import("../repos/tagRepo");
      const page = await seed();
      const tag = await db.taxonomy.create({
        data: {
          type: "TAG",
          name: "Changing type",
          slug: `${prefix}-${randomUUID()}`,
        },
      });
      const client = new Client({ connectionString: url });
      await client.connect();

      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE "Taxonomy" SET type = 'CATEGORY' WHERE id = $1`,
          [tag.id],
        );
        await expect(
          setTagsForPage(page.id, [tag.id], undefined, actor),
        ).rejects.toThrow();
        expect(
          await db.pageOnTaxonomy.count({ where: { pageId: page.id } }),
        ).toBe(0);
      } finally {
        await client.query("ROLLBACK");
        await client.end();
      }
      await setTagsForPage(page.id, [tag.id], undefined, actor);
      expect(
        await db.pageOnTaxonomy.count({
          where: { pageId: page.id, taxonomyId: tag.id },
        }),
      ).toBe(1);
    });

    it("fails closed when writer coordination is disabled", async () => {
      const page = await seed();
      const input = await command(page.id);
      await db.$executeRaw`ALTER TABLE "PageMedia" DISABLE TRIGGER private_source_mutation`;

      try {
        await expect(
          saveDisposableWorkingAggregate(db, input, actor),
        ).rejects.toThrow("WRITER_FENCE_UNAVAILABLE");
      } finally {
        await db.$executeRaw`ALTER TABLE "PageMedia" ENABLE ALWAYS TRIGGER private_source_mutation`;
      }
      await expect(
        saveDisposableWorkingAggregate(db, input, actor),
      ).resolves.toMatchObject({ version: 1 });
    });

    it("fences taxonomy reclassification even when the private patch removes that tag", async () => {
      const page = await seed();
      const tag = await db.taxonomy.create({
        data: {
          type: "TAG",
          name: "Reclassified",
          slug: `${prefix}-${randomUUID()}`,
        },
      });
      await db.pageOnTaxonomy.create({
        data: { pageId: page.id, taxonomyId: tag.id },
      });
      const input = await command(page.id);
      const client = new Client({ connectionString: url });
      await client.connect();

      try {
        await client.query("BEGIN");
        await client.query(
          'SELECT version FROM "NPContentFence" WHERE "pageId" = $1 FOR UPDATE',
          [page.id],
        );
        await expect(
          db.taxonomy.update({
            where: { id: tag.id },
            data: { type: "CATEGORY" },
          }),
        ).rejects.toThrow();
      } finally {
        await client.query("ROLLBACK");
        await client.end();
      }
      await db.taxonomy.update({
        where: { id: tag.id },
        data: { type: "CATEGORY" },
      });
      await expect(
        saveDisposableWorkingAggregate(
          db,
          { ...input, edit: { ...input.edit, patch: { tagIds: [] } } },
          actor,
        ),
      ).rejects.toThrow("SOURCE_VERSION_CONFLICT");
    });
  },
);
