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

    it("reserves the Homepage slot across concurrent writes regardless of publication status", async () => {
      const records = await Promise.all([seed(), seed()]);

      const assignHomepage = (id: string) =>
        db.page.update({ where: { id }, data: { layout: "HOME" } });

      const results = await Promise.allSettled(
        records.map(({ id }) => assignHomepage(id)),
      );

      const selected = await db.page.findMany({
        where: { id: { in: records.map(({ id }) => id) }, layout: "HOME" },
      });

      expect(results.map(({ status }) => status).sort()).toEqual([
        "fulfilled",
        "rejected",
      ]);
      expect(selected).toHaveLength(1);
      const [active] = selected;
      const replacement = records.find(({ id }) => id !== active?.id);

      if (!active || !replacement) {
        throw new Error("Expected one active homepage and one replacement");
      }

      await db.page.update({
        where: { id: active.id },
        data: { status: "DRAFT" },
      });
      await expect(assignHomepage(replacement.id)).rejects.toBeDefined();
    });

    it.each([
      ["PAGE", "title"],
      ["PAGE", "slug"],
      ["POST", "title"],
      ["POST", "slug"],
    ] as const)(
      "rejects invalid captured and restored %s publication %s",
      async (kind, field) => {
        const publisher = { id: randomUUID(), role: "ADMIN" as const };
        await db.user.create({
          data: { id: publisher.id, roleId: "b04-admin" },
        });
        const source = await seed(kind);
        await db.page.update({
          where: { id: source.id },
          data:
            field === "title"
              ? { title: "" }
              : { slug: `INVALID_${randomUUID()}` },
        });

        const make = async (operation?: string) => {
          const input = await command(source.id);

          return {
            ...input,
            ...(operation ? { operation } : {}),
            edit: { ...input.edit, patch: {} },
          };
        };
        await saveDisposableWorkingAggregate(db, await make(), publisher);

        for (const operation of ["PUBLISH", "SCHEDULE"]) {
          const input = await make(operation);
          await expect(
            saveDisposableWorkingAggregate(
              db,
              {
                ...input,
                ...(operation === "SCHEDULE"
                  ? { scheduledFor: new Date(Date.now() + 60000).toISOString() }
                  : {}),
              },
              publisher,
            ),
          ).rejects.toThrow();
        }

        // Emulate an immutable schedule accepted by the historical permissive writer.
        const captured = await loadDisposableWorkingAggregate(
          db,
          source.id,
          publisher,
        );
        const historicalSchedule = {
          ...captured.aggregate,
          release: {
            id: randomUUID(),
            pinnedVersion: 1,
            actorId: publisher.id,
            actorRole: publisher.role,
            scheduledFor: new Date(Date.now() - 1000).toISOString(),
            state: "PENDING",
          },
        };
        await db.$executeRaw`INSERT INTO "NPWorkingRevision"
          (id, "pageId", version, "sourceVersion", "requestId", "requestHash", aggregate)
          VALUES (${randomUUID()}::uuid, ${source.id}, 2, ${captured.sourceVersion}, ${randomUUID()}::uuid,
            'historical-fixture', ${JSON.stringify(historicalSchedule)}::jsonb)`;
        const { saveWorkingAggregate } =
          await import("../services/working-aggregate-persistence.server");
        await expect(
          saveWorkingAggregate(db, await make("EXECUTE"), publisher, {
            scheduledExecution: true,
          }),
        ).rejects.toThrow();
        const valid = await make();
        await saveDisposableWorkingAggregate(
          db,
          {
            ...valid,
            edit: {
              ...valid.edit,
              patch: { title: "Valid", slug: `valid-${randomUUID()}` },
            },
          },
          publisher,
        );
        await saveDisposableWorkingAggregate(
          db,
          { ...(await make("RESTORE")), restoreVersion: 1 },
          publisher,
        );
        const before = await db.page.findUniqueOrThrow({
          where: { id: source.id },
        });
        await expect(
          saveDisposableWorkingAggregate(db, await make("PUBLISH"), publisher),
        ).rejects.toThrow();
        expect(
          await db.page.findUniqueOrThrow({ where: { id: source.id } }),
        ).toEqual(before);
        expect(
          (await loadDisposableWorkingAggregate(db, source.id, publisher))
            .version,
        ).toBe(4);
        await saveDisposableWorkingAggregate(
          db,
          await make("CANCEL_SCHEDULE"),
          publisher,
        );
      },
    );

    it("continues beyond a full refused cohort without discarding schedules", async () => {
      const blocked = { id: randomUUID(), role: "ADMIN" as const };
      const allowed = { id: randomUUID(), role: "ADMIN" as const };

      for (const publisher of [blocked, allowed]) {
        await db.user.create({
          data: { id: publisher.id, roleId: "b04-admin" },
        });
      }

      const ids: string[] = [];

      const { loadWorkingAggregate, saveWorkingAggregate } =
        await import("../services/working-aggregate-persistence.server");

      const schedule = async (publisher: typeof blocked) => {
        const source = await seed();
        const current = await loadWorkingAggregate(db, source.id, publisher);

        const saved = await saveWorkingAggregate(
          db,
          {
            pageId: source.id,
            requestId: randomUUID(),
            expectedDraftVersion: current.version,
            expectedSourceVersion: current.sourceVersion,
            edit: {
              expectedVersion: current.aggregate.baseVersion,
              expectedFingerprint: current.aggregate.baseFingerprint,
              patch: { title: "Scheduled" },
            },
          },
          publisher,
        );
        await saveWorkingAggregate(
          db,
          {
            pageId: source.id,
            requestId: randomUUID(),
            expectedDraftVersion: saved.version,
            expectedSourceVersion: saved.sourceVersion,
            operation: "SCHEDULE",
            scheduledFor: new Date(Date.now() + 1000).toISOString(),
            edit: {
              expectedVersion: saved.aggregate.baseVersion,
              expectedFingerprint: saved.aggregate.baseFingerprint,
              patch: {},
            },
          },
          publisher,
        );

        return source.id;
      };

      for (let batch = 0; batch < 4; batch++) {
        ids.push(
          ...(await Promise.all(
            Array.from({ length: 5 }, () => schedule(blocked)),
          )),
        );
      }

      ids.push(await schedule(allowed));
      await db.user.update({
        where: { id: blocked.id },
        data: { roleId: "b04-subscriber" },
      });
      await new Promise((done) => setTimeout(done, 1100));
      const { executeDuePrivateReleases } =
        await import("../services/private-release-executor.server");
      let result = await executeDuePrivateReleases(db);
      expect(result.results.some((row) => row.pageId === ids[20])).toBe(false);
      expect(result.nextCursor).not.toBeNull();

      for (let batch = 0; result.nextCursor && batch < 10; batch++) {
        result = await executeDuePrivateReleases(db, {
          after: result.nextCursor,
        });

        if (
          result.results.some(
            (row) => row.pageId === ids[20] && row.outcome === "executed",
          )
        ) {
          break;
        }
      }

      expect(result.results).toContainEqual({
        pageId: ids[20],
        outcome: "executed",
      });
      expect(
        (await loadDisposableWorkingAggregate(db, ids[0] ?? "", blocked))
          .aggregate.release?.state,
      ).toBe("PENDING");
      // Restored privileges permit retry in a fresh sweep.
      await db.user.update({
        where: { id: blocked.id },
        data: { roleId: "b04-admin" },
      });
      const retry = await command(ids[0] ?? "");
      await saveWorkingAggregate(
        db,
        { ...retry, operation: "EXECUTE", edit: { ...retry.edit, patch: {} } },
        blocked,
        { scheduledExecution: true },
      );
      expect(
        (await loadDisposableWorkingAggregate(db, ids[0] ?? "", blocked))
          .aggregate.release?.state,
      ).toBe("EXECUTED");
      // Close only this test's remaining schedules through the supported lifecycle.
      await Promise.all(
        ids.slice(1, 20).map(async (pageId) => {
          const current = await loadWorkingAggregate(db, pageId, blocked);
          await saveWorkingAggregate(
            db,
            {
              pageId,
              requestId: randomUUID(),
              operation: "CANCEL_SCHEDULE",
              expectedDraftVersion: current.version,
              expectedSourceVersion: current.sourceVersion,
              edit: {
                expectedVersion: current.aggregate.baseVersion,
                expectedFingerprint: current.aggregate.baseFingerprint,
                patch: {},
              },
            },
            blocked,
          );
        }),
      );
    });

    it("refuses scheduled execution after actor demotion, ownership and source changes", async () => {
      const owner = { id: randomUUID(), role: "AUTHOR" as const };
      await db.user.create({ data: { id: owner.id, roleId: "b04-author" } });
      const source = await seed();
      await db.page.update({
        where: { id: source.id },
        data: { authorId: owner.id },
      });
      const edit = await command(source.id);
      await saveDisposableWorkingAggregate(db, edit, owner);
      const input = await command(source.id);
      await saveDisposableWorkingAggregate(
        db,
        {
          ...input,
          operation: "SCHEDULE",
          scheduledFor: new Date(Date.now() + 1000).toISOString(),
          edit: { ...input.edit, patch: {} },
        },
        owner,
      );
      await new Promise((done) => setTimeout(done, 1100));
      const { executeDuePrivateReleases } =
        await import("../services/private-release-executor.server");

      const before = await db.page.findUniqueOrThrow({
        where: { id: source.id },
      });
      await db.user.update({
        where: { id: owner.id },
        data: { roleId: "b04-subscriber" },
      });
      expect((await executeDuePrivateReleases(db)).results).toContainEqual({
        pageId: source.id,
        outcome: "refused",
        code: "EXECUTION_REFUSED",
      });
      expect(
        await db.page.findUniqueOrThrow({ where: { id: source.id } }),
      ).toEqual(before);
      await db.user.update({
        where: { id: owner.id },
        data: { roleId: "b04-author" },
      });
      await db.page.update({
        where: { id: source.id },
        data: { authorId: null },
      });
      expect((await executeDuePrivateReleases(db)).results).toContainEqual({
        pageId: source.id,
        outcome: "refused",
        code: "EXECUTION_REFUSED",
      });
      await db.page.update({
        where: { id: source.id },
        data: { authorId: owner.id },
      });
      expect((await executeDuePrivateReleases(db)).results).toContainEqual({
        pageId: source.id,
        outcome: "refused",
        code: "SOURCE_VERSION_CONFLICT",
      });
    });

    it("retries an interrupted execution without exposing partial content or losing newer private edits", async () => {
      const publicationActor = { id: randomUUID(), role: "ADMIN" as const };
      await db.user.create({
        data: { id: publicationActor.id, roleId: "b04-admin" },
      });
      const source = await seed();
      const input = await command(source.id);
      await saveDisposableWorkingAggregate(db, input, publicationActor);
      const current = await command(source.id);
      await saveDisposableWorkingAggregate(
        db,
        {
          ...current,
          operation: "SCHEDULE",
          scheduledFor: new Date(Date.now() + 1000).toISOString(),
          edit: { ...current.edit, patch: {} },
        },
        publicationActor,
      );
      const later = await command(source.id);
      await saveDisposableWorkingAggregate(
        db,
        {
          ...later,
          edit: { ...later.edit, patch: { title: "Newer private edits" } },
        },
        publicationActor,
      );
      await new Promise((done) => setTimeout(done, 1100));
      const { executeDuePrivateReleases } =
        await import("../services/private-release-executor.server");
      await db.$executeRaw`CREATE FUNCTION np_fail_publication() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected publication failure'; END $$`;
      await db.$executeRaw`CREATE TRIGGER np_fail_publication BEFORE INSERT ON "NPWorkingRevision" FOR EACH ROW EXECUTE FUNCTION np_fail_publication()`;

      try {
        expect((await executeDuePrivateReleases(db)).results).toContainEqual({
          pageId: source.id,
          outcome: "refused",
          code: "EXECUTION_REFUSED",
        });
        expect(
          await db.page.findUniqueOrThrow({ where: { id: source.id } }),
        ).toEqual(source);
        expect(
          await db.pageRevision.count({ where: { pageId: source.id } }),
        ).toBe(0);
        expect(
          (
            await loadDisposableWorkingAggregate(
              db,
              source.id,
              publicationActor,
            )
          ).aggregate.release?.state,
        ).toBe("PENDING");
      } finally {
        await db.$executeRaw`DROP TRIGGER np_fail_publication ON "NPWorkingRevision"`;
        await db.$executeRaw`DROP FUNCTION np_fail_publication()`;
      }

      expect((await executeDuePrivateReleases(db)).results).toContainEqual({
        pageId: source.id,
        outcome: "executed",
      });
      expect(
        (await db.page.findUniqueOrThrow({ where: { id: source.id } })).title,
      ).toBe("Private title");
      const final = await loadDisposableWorkingAggregate(
        db,
        source.id,
        publicationActor,
      );
      expect(final.aggregate.snapshot.fields.title).toBe("Newer private edits");
      expect(final.aggregate.release?.state).toBe("EXECUTED");
      expect(
        await db.contentEditorialState.count({ where: { pageId: source.id } }),
      ).toBe(0);
    });

    it.each(["PAGE", "POST"] as const)(
      "atomically publishes, unpublishes and executes durable %s schedules",
      async (kind) => {
        const publicationActor = {
          id: randomUUID(),
          role: "ADMIN" as const,
        };
        await db.user.create({
          data: { id: publicationActor.id, roleId: "b04-admin" },
        });
        const source = await seed(kind);
        await db.page.update({
          where: { id: source.id },
          data: { status: "DRAFT" },
        });
        const tag = await db.taxonomy.create({
          data: { type: "TAG", name: "Publication tag", slug: randomUUID() },
        });

        const category = await db.taxonomy.create({
          data: {
            type: "CATEGORY",
            name: "Historical category",
            slug: randomUUID(),
          },
        });
        await db.pageOnTaxonomy.create({
          data: { pageId: source.id, taxonomyId: category.id },
        });
        const initial = await command(source.id);
        await saveDisposableWorkingAggregate(
          db,
          {
            ...initial,
            edit: {
              ...initial.edit,
              patch: { title: "Private title", tagIds: [tag.id] },
            },
          },
          publicationActor,
        );
        await expect(
          db.taxonomy.delete({ where: { id: tag.id } }),
        ).rejects.toThrow();
        expect(
          (await db.page.findUniqueOrThrow({ where: { id: source.id } })).title,
        ).toBe(source.title);

        const make = async (operation: string, extra = {}) => {
          const input = await command(source.id);

          return {
            ...input,
            ...(operation ? { operation } : {}),
            edit: { ...input.edit, patch: {} },
            ...extra,
          };
        };
        const publish = await make("PUBLISH");

        const published = await saveDisposableWorkingAggregate(
          db,
          publish,
          publicationActor,
        );

        const live = await db.page.findUniqueOrThrow({
          where: { id: source.id },
        });
        expect(live).toMatchObject({
          title: "Private title",
          status: "PUBLISHED",
          eventLocation: source.eventLocation,
        });
        expect(live.publishedAt?.getTime()).toBeLessThanOrEqual(Date.now());
        expect(
          await db.pageOnTaxonomy.findMany({
            where: { pageId: source.id },
            orderBy: { taxonomyId: "asc" },
          }),
        ).toEqual(
          [tag.id, category.id]
            .sort()
            .map((taxonomyId) => ({ pageId: source.id, taxonomyId })),
        );
        expect(published.aggregate.receipt?.operation).toBe("PUBLISH");
        expect(
          await saveDisposableWorkingAggregate(db, publish, publicationActor),
        ).toEqual(published);
        await expect(
          saveDisposableWorkingAggregate(
            db,
            { ...publish, operation: "UNPUBLISH" },
            publicationActor,
          ),
        ).rejects.toThrow("REQUEST_REUSE_CONFLICT");
        const stale = { ...publish, requestId: randomUUID() };
        await expect(
          saveDisposableWorkingAggregate(db, stale, publicationActor),
        ).rejects.toThrow("DRAFT_VERSION_CONFLICT");
        const edit = await command(source.id);
        await saveDisposableWorkingAggregate(
          db,
          {
            ...edit,
            edit: { ...edit.edit, patch: { title: "Published changes" } },
          },
          publicationActor,
        );
        expect(
          (await db.page.findUniqueOrThrow({ where: { id: source.id } })).title,
        ).toBe("Private title");
        const concurrent = await make("PUBLISH");

        const attempts = await Promise.allSettled([
          saveDisposableWorkingAggregate(db, concurrent, publicationActor),
          saveDisposableWorkingAggregate(
            db,
            { ...concurrent, requestId: randomUUID() },
            publicationActor,
          ),
        ]);
        expect(
          attempts.filter((result) => result.status === "fulfilled"),
        ).toHaveLength(1);
        expect(
          (await db.page.findUniqueOrThrow({ where: { id: source.id } }))
            .publishedAt,
        ).toEqual(live.publishedAt);
        const schedule = await make("SCHEDULE", {
          scheduledFor: new Date(Date.now() + 60000).toISOString(),
        });

        const scheduled = await saveDisposableWorkingAggregate(
          db,
          schedule,
          publicationActor,
        );
        expect(scheduled.aggregate.release?.state).toBe("PENDING");
        expect(
          (await db.page.findUniqueOrThrow({ where: { id: source.id } })).title,
        ).toBe("Published changes");
        const cancel = await make("CANCEL_SCHEDULE");

        const cancelled = await saveDisposableWorkingAggregate(
          db,
          cancel,
          publicationActor,
        );
        expect(cancelled.aggregate.release?.state).toBe("CANCELLED");
        expect(
          await saveDisposableWorkingAggregate(db, cancel, publicationActor),
        ).toEqual(cancelled);
        await saveDisposableWorkingAggregate(
          db,
          await make("SCHEDULE", {
            scheduledFor: new Date(Date.now() + 60000).toISOString(),
          }),
          publicationActor,
        );
        const unpublish = await make("UNPUBLISH");

        const unpublished = await saveDisposableWorkingAggregate(
          db,
          unpublish,
          publicationActor,
        );
        expect(unpublished.aggregate.release?.state).toBe("CANCELLED");
        const hidden = await db.page.findUniqueOrThrow({
          where: { id: source.id },
        });
        expect(hidden).toMatchObject({
          status: "DRAFT",
          title: "Published changes",
          publishedAt: live.publishedAt,
        });
        expect(
          await saveDisposableWorkingAggregate(db, unpublish, publicationActor),
        ).toEqual(unpublished);
        const due = await make("SCHEDULE");
        await saveDisposableWorkingAggregate(
          db,
          { ...due, scheduledFor: new Date(Date.now() + 3000).toISOString() },
          publicationActor,
        );
        await new Promise((done) => setTimeout(done, 3100));
        const { executeDuePrivateReleases } =
          await import("../services/private-release-executor.server");

        const executions = await Promise.all([
          executeDuePrivateReleases(db),
          executeDuePrivateReleases(db),
        ]);
        expect(
          executions.flatMap((execution) => execution.results),
        ).toContainEqual({
          pageId: source.id,
          outcome: "executed",
        });
        const afterExecution = await db.page.findUniqueOrThrow({
          where: { id: source.id },
        });
        expect(afterExecution.status).toBe("PUBLISHED");
        await executeDuePrivateReleases(db);
        expect(
          await db.page.findUniqueOrThrow({ where: { id: source.id } }),
        ).toEqual(afterExecution);
        expect(
          await db.pageRevision.count({ where: { pageId: source.id } }),
        ).toBe(4);
        const laterUnpublish = await saveDisposableWorkingAggregate(
          db,
          await make("UNPUBLISH"),
          publicationActor,
        );
        expect(laterUnpublish.aggregate.release?.state).toBe("EXECUTED");
      },
      60000,
    );

    it("rolls publication back and refuses changed roles and source epochs", async () => {
      const publicationActor = {
        id: randomUUID(),
        role: "ADMIN" as const,
      };
      await db.user.create({
        data: { id: publicationActor.id, roleId: "b04-admin" },
      });
      const source = await seed();
      const other = await seed();
      const input = await command(source.id);
      await saveDisposableWorkingAggregate(
        db,
        { ...input, edit: { ...input.edit, patch: { slug: other.slug } } },
        publicationActor,
      );
      const next = await command(source.id);
      const publish = {
        ...next,
        operation: "PUBLISH",
        edit: { ...next.edit, patch: {} },
      };
      const before = await db.nPWorkingRevision.count({
        where: { pageId: source.id },
      });
      await expect(
        saveDisposableWorkingAggregate(db, publish, publicationActor),
      ).rejects.toThrow();
      expect(
        await db.page.findUniqueOrThrow({ where: { id: source.id } }),
      ).toEqual(source);
      expect(
        await db.pageRevision.count({ where: { pageId: source.id } }),
      ).toBe(0);
      expect(
        await db.nPWorkingRevision.count({ where: { pageId: source.id } }),
      ).toBe(before);
      await db.user.update({
        where: { id: publicationActor.id },
        data: { roleId: "b04-subscriber" },
      });
      await expect(
        saveDisposableWorkingAggregate(db, publish, publicationActor),
      ).rejects.toThrow();
      await db.user.update({
        where: { id: publicationActor.id },
        data: { roleId: "b04-admin" },
      });
      await db.page.update({
        where: { id: source.id },
        data: { title: "External source" },
      });
      await expect(
        saveDisposableWorkingAggregate(db, publish, publicationActor),
      ).rejects.toThrow("SOURCE_VERSION_CONFLICT");
    });

    it.each(["PAGE", "POST"] as const)(
      "restores partial legacy %s history privately and rejects stale, foreign and unsupported commands",
      async (type) => {
        const page = await seed(type);

        const historical = await db.pageRevision.create({
          data: {
            pageId: page.id,
            title: "Legacy restored",
            slug: page.slug,
            content: "Original historical bytes",
            excerpt: null,
            layout: "STANDARD",
            pageDocument: '{ "version": 1, "blocks": [] }',
            workingVersion: 1,
            status: "DRAFT",
          },
        });

        const unsupported = await db.pageRevision.create({
          data: {
            ...historical,
            id: randomUUID(),
            pageDocument: '{"version":99,"blocks":[]}',
          },
        });

        const initial = await command(page.id);
        const restore = {
          ...initial,
          operation: "RESTORE_LEGACY",
          legacyRevisionId: historical.id,
          edit: { ...initial.edit, patch: {} },
        };
        const result = await saveDisposableWorkingAggregate(db, restore, actor);
        expect(result.aggregate.snapshot.fields).toMatchObject({
          title: historical.title,
          content: historical.content,
          layout: historical.layout,
          eventLocation: page.eventLocation,
          inHeaderMenu: page.inHeaderMenu,
        });
        expect(result.aggregate.rawPageDocument).toBe(historical.pageDocument);
        expect(result.aggregate.publicationIntent).toEqual({
          action: "PRESERVE",
        });
        expect(
          await saveDisposableWorkingAggregate(db, restore, actor),
        ).toEqual(result);
        await expect(
          saveDisposableWorkingAggregate(
            db,
            { ...restore, legacyRevisionId: unsupported.id },
            actor,
          ),
        ).rejects.toThrow("REQUEST_REUSE_CONFLICT");
        await expect(
          saveDisposableWorkingAggregate(
            db,
            { ...restore, requestId: randomUUID() },
            actor,
          ),
        ).rejects.toThrow("DRAFT_VERSION_CONFLICT");
        const latest = await command(page.id);
        const next = {
          ...latest,
          operation: "RESTORE_LEGACY",
          legacyRevisionId: unsupported.id,
          edit: { ...latest.edit, patch: {} },
        };
        await expect(
          saveDisposableWorkingAggregate(db, next, actor),
        ).rejects.toThrow("UNSUPPORTED_LEGACY_REVISION");
        await expect(
          saveDisposableWorkingAggregate(
            db,
            { ...next, legacyRevisionId: historical.id, restoreVersion: 1 },
            actor,
          ),
        ).rejects.toThrow("RESTORE_COMMAND_CONFLICT");
        const foreign = await seed(type);
        const foreignInput = await command(foreign.id);
        await expect(
          saveDisposableWorkingAggregate(
            db,
            {
              ...foreignInput,
              operation: "RESTORE_LEGACY",
              legacyRevisionId: historical.id,
              edit: { ...foreignInput.edit, patch: {} },
            },
            actor,
          ),
        ).rejects.toThrow();
        const { loadWorkingAggregate } =
          await import("../services/working-aggregate-persistence.server");
        expect(
          (
            await loadWorkingAggregate(db, page.id, actor, {
              includeSourceMetadata: true,
            })
          ).legacyHistory,
        ).toEqual([
          {
            id: historical.id,
            title: historical.title,
            createdAt: historical.createdAt.toISOString(),
          },
        ]);
        expect(
          await db.pageRevision.findUnique({ where: { id: historical.id } }),
        ).toEqual(historical);
        expect(await db.page.findUnique({ where: { id: page.id } })).toEqual(
          page,
        );
        expect(
          await db.nPWorkingRevision.count({ where: { pageId: page.id } }),
        ).toBe(1);
        await db.page.update({
          where: { id: page.id },
          data: { title: "Source changed" },
        });
        await expect(
          saveDisposableWorkingAggregate(
            db,
            { ...next, legacyRevisionId: historical.id },
            actor,
          ),
        ).rejects.toThrow("SOURCE_VERSION_CONFLICT");
      },
      30000,
    );

    it.each(["PAGE", "POST"] as const)(
      "restores %s history privately with durable replay, retained fields and stale-token rejection",
      async (type) => {
        const page = await seed(type);

        const first = await saveDisposableWorkingAggregate(
          db,
          await command(page.id),
          actor,
        );

        const second = await command(page.id);
        await saveDisposableWorkingAggregate(
          db,
          {
            ...second,
            edit: { ...second.edit, patch: { title: "Later private title" } },
          },
          actor,
        );
        const latest = await command(page.id);
        const restore = {
          ...latest,
          operation: "RESTORE",
          restoreVersion: first.version,
          edit: { ...latest.edit, patch: {} },
        };
        const result = await saveDisposableWorkingAggregate(db, restore, actor);
        const { savedAt: originalTime, ...originalAggregate } = first.aggregate;
        const { savedAt: restoredTime, ...restoredAggregate } =
          result.aggregate;
        expect(result.version).toBe(3);
        expect(restoredAggregate).toEqual(originalAggregate);
        expect(Date.parse(restoredTime ?? "")).toBeGreaterThanOrEqual(
          Date.parse(originalTime ?? ""),
        );
        expect(
          await saveDisposableWorkingAggregate(db, restore, actor),
        ).toEqual(result);
        expect(
          await db.page.findUniqueOrThrow({ where: { id: page.id } }),
        ).toEqual(page);
        expect(
          await db.nPWorkingRevision.count({ where: { pageId: page.id } }),
        ).toBe(3);
        const { loadWorkingAggregate } =
          await import("../services/working-aggregate-persistence.server");
        expect(
          (
            await loadWorkingAggregate(db, page.id, actor, {
              includeSourceMetadata: true,
            })
          ).history,
        ).toEqual([
          { version: 3, title: "Private title" },
          { version: 2, title: "Later private title" },
          { version: 1, title: "Private title" },
        ]);
        await expect(
          saveDisposableWorkingAggregate(
            db,
            { ...restore, requestId: randomUUID() },
            actor,
          ),
        ).rejects.toThrow("DRAFT_VERSION_CONFLICT");
        await db.page.update({
          where: { id: page.id },
          data: { title: "External update" },
        });
        await expect(
          saveDisposableWorkingAggregate(
            db,
            {
              ...restore,
              requestId: randomUUID(),
              expectedDraftVersion: 3,
            },
            actor,
          ),
        ).rejects.toThrow("SOURCE_VERSION_CONFLICT");
      },
      // Each adapter call independently verifies Docker and database identity.
      // This end-to-end sequence includes nine such guarded calls.
      30000,
    );

    it("restores content with the current baseline and no historical publication intent after reset", async () => {
      const page = await seed();
      const initial = await command(page.id);

      const old = await saveDisposableWorkingAggregate(
        db,
        {
          ...initial,
          edit: {
            ...initial.edit,
            publicationIntent: { action: "CHANGE", status: "DRAFT" },
          },
        },
        actor,
      );
      await db.page.update({
        where: { id: page.id },
        data: { title: "New baseline", status: "DRAFT" },
      });
      const { loadWorkingAggregate } =
        await import("../services/working-aggregate-persistence.server");

      const drifted = await loadWorkingAggregate(db, page.id, actor, {
        includeSourceMetadata: true,
      });
      await saveDisposableWorkingAggregate(
        db,
        {
          ...initial,
          requestId: randomUUID(),
          operation: "RESET",
          expectedDraftVersion: old.version,
          expectedSourceVersion: drifted.currentSourceVersion,
          edit: { ...initial.edit, patch: {} },
        },
        actor,
      );
      const current = await command(page.id);
      const restore = {
        ...current,
        operation: "RESTORE",
        restoreVersion: 1,
        edit: { ...current.edit, patch: {} },
      };
      const restored = await saveDisposableWorkingAggregate(db, restore, actor);
      expect(restored.aggregate.snapshot).toEqual(old.aggregate.snapshot);
      expect(restored.aggregate.baseFingerprint).not.toBe(
        old.aggregate.baseFingerprint,
      );
      expect(restored.aggregate.publicState.status).toBe("DRAFT");
      expect(restored.aggregate.publicationIntent).toEqual({
        action: "PRESERVE",
      });
      expect(
        (await db.page.findUniqueOrThrow({ where: { id: page.id } })).title,
      ).toBe("New baseline");
    });

    it("rejects missing historical revisions and malformed restore commands without appending", async () => {
      const page = await seed();
      const input = await command(page.id);
      const restore = {
        ...input,
        operation: "RESTORE",
        restoreVersion: 99,
        edit: { ...input.edit, patch: {} },
      };
      await expect(
        saveDisposableWorkingAggregate(db, restore, actor),
      ).rejects.toThrow();
      await expect(
        saveDisposableWorkingAggregate(
          db,
          { ...restore, edit: input.edit },
          actor,
        ),
      ).rejects.toThrow("RESTORE_COMMAND_CONFLICT");
      await expect(
        saveDisposableWorkingAggregate(
          db,
          { ...input, restoreVersion: 1 },
          actor,
        ),
      ).rejects.toThrow("RESTORE_COMMAND_CONFLICT");
      expect(
        await db.nPWorkingRevision.count({ where: { pageId: page.id } }),
      ).toBe(0);
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
      const cohort = await reconcilePrivateDraftReadiness(db, { limit: 1 });
      expect(cohort.records).toHaveLength(1);
      expect(cohort.complete).toBe(false);
      expect(cohort.clean).toBe(false);
      expect(cohort.deploymentReady).toBe(false);
      expect(cohort.nextCursor).toBe(cohort.records[0]?.id);
      const next = await reconcilePrivateDraftReadiness(db, {
        limit: 1,
        afterId: cohort.nextCursor,
      });
      expect(next.records[0]?.id).not.toBe(cohort.records[0]?.id);
      expect(next.complete).toBe(false);
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
      const { savedAt: firstTime, ...firstAggregate } = first.aggregate;
      const { savedAt: secondTime, ...secondAggregate } = second.aggregate;
      expect(second.version).toBe(2);
      expect(secondAggregate).toEqual(firstAggregate);
      expect(Date.parse(secondTime ?? "")).toBeGreaterThanOrEqual(
        Date.parse(firstTime ?? ""),
      );
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
