import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { disposableDatabaseName } from "./disposable-database";
import { verifyDisposableDatabase } from "./docker-database";

const url = process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
let db: typeof import("@nextpress/db/src/client").prisma;
let persistLegacyPageInDisposableDatabase: typeof import("./legacy-backfill-persistence").persistLegacyPageInDisposableDatabase;
let backfillLegacyContent: typeof import("../services/legacy-content-backfill.server").backfillLegacyContent;
let reconcileLegacyContent: typeof import("../services/legacy-content-backfill.server").reconcileLegacyContent;
const prefix = "b052b-";
const publishedAt = new Date("2020-01-01T00:00:00Z");

async function seed(id: string, published = false) {
  return db.page.create({
    data: {
      id,
      type: "PAGE",
      title: "Synthetic",
      slug: id,
      content: "<p>Retained bytes</p>",
      status: published ? "PUBLISHED" : "DRAFT",
      publishedAt: published ? publishedAt : null,
    },
  });
}

async function diagnostic(id: string) {
  return (await reconcileLegacyContent(db)).records.find(
    (row) => row.id === id,
  );
}

describe.skipIf(!url)("isolated transactional legacy backfill", () => {
  beforeAll(async () => {
    const name = disposableDatabaseName(
      url,
      process.env.DATABASE_URL,
      "content",
    );
    const candidate = (await import("@nextpress/db/src/client")).prisma;
    await verifyDisposableDatabase(name, candidate);
    db = candidate;
    ({ persistLegacyPageInDisposableDatabase } =
      await import("./legacy-backfill-persistence"));
    ({ backfillLegacyContent, reconcileLegacyContent } =
      await import("../services/legacy-content-backfill.server"));
  });

  afterAll(async () => {
    if (db) {
      // The runner removes the entire verified cluster. Restrictive revision FKs stay exercised.
      await db.$disconnect();
    }
  });

  it("persists a complete page atomically and repeats without new records or legacy changes", async () => {
    const id = prefix + "initial";
    const page = await seed(id, true);
    expect(await persistLegacyPageInDisposableDatabase(db, id)).toBe("created");
    const before = await db.contentRevision.findMany({ where: { pageId: id } });
    expect(await persistLegacyPageInDisposableDatabase(db, id)).toBe(
      "existing",
    );
    expect(
      await db.contentRevision.findMany({ where: { pageId: id } }),
    ).toEqual(before);
    expect(await db.page.findUnique({ where: { id } })).toEqual(page);
    expect(
      await db.contentPublication.findFirst({ where: { pageId: id } }),
    ).toMatchObject({
      displayedPublishedAt: publishedAt,
      effectiveAt: publishedAt,
    });
    expect(await diagnostic(id)).toMatchObject({
      state: "enrolled",
      issues: [],
    });
  });

  it("orders historical revisions and persists historical and current edges once", async () => {
    const id = prefix + "history";
    await seed(id);
    const media = await db.media.create({
      data: { id: prefix + "media", url: "/synthetic", mime: "image/png" },
    });
    const taxonomy = await db.taxonomy.create({
      data: {
        id: prefix + "tag",
        type: "TAG",
        name: "Synthetic",
        slug: prefix + "tag",
      },
    });
    const parent = await seed(prefix + "parent");
    await db.page.update({
      where: { id },
      data: {
        coverId: media.id,
        parentId: parent.id,
        taxonomies: { create: { taxonomyId: taxonomy.id } },
      },
    });
    const document = JSON.stringify({
      version: 1,
      blocks: [
        {
          id: "image",
          version: 1,
          type: "image",
          props: { mediaId: media.id, alt: "" },
        },
      ],
    });

    for (const number of [2, 1]) {
      await db.pageRevision.create({
        data: {
          id: `${id}-${number}`,
          pageId: id,
          workingVersion: number,
          title: `History ${number}`,
          slug: id,
          content: "Historical bytes",
          pageDocument: document,
          layout: "STANDARD",
          status: "DRAFT",
        },
      });
    }
    await persistLegacyPageInDisposableDatabase(db, id);
    await persistLegacyPageInDisposableDatabase(db, id);
    const revisions = await db.contentRevision.findMany({
      where: { pageId: id },
      orderBy: { number: "asc" },
    });
    expect(revisions.map((row) => row.number)).toEqual([1, 2, 3]);
    expect(
      revisions
        .slice(0, 2)
        .map((row) => JSON.parse(row.rawSource ?? "{}").workingVersion),
    ).toEqual([1, 2]);
    expect(
      await db.contentLegacyRevisionImport.count({ where: { pageId: id } }),
    ).toBe(2);
    expect(
      await db.contentRevisionMedia.count({
        where: { revision: { pageId: id } },
      }),
    ).toBe(3);
    expect(
      await db.contentRevisionTaxonomy.count({
        where: { revision: { pageId: id } },
      }),
    ).toBe(1);
    expect(
      await db.contentRevisionPageReference.count({
        where: { revision: { pageId: id } },
      }),
    ).toBe(1);
    expect(await diagnostic(id)).toMatchObject({ issues: [] });
  });

  it("holds unresolved references and retries after an earlier page commits", async () => {
    const good = prefix + "batch-good";
    const held = prefix + "batch-held";
    await seed(good);
    await seed(held);
    const document = JSON.stringify({
      version: 1,
      blocks: [
        {
          id: "image",
          version: 1,
          type: "image",
          props: { mediaId: prefix + "missing", alt: "" },
        },
      ],
    });
    await db.page.update({
      where: { id: held },
      data: { pageDocument: document },
    });
    await persistLegacyPageInDisposableDatabase(db, good);
    await expect(
      persistLegacyPageInDisposableDatabase(db, held),
    ).rejects.toMatchObject({ code: "UNRESOLVED_SOURCE" });
    expect(await db.contentRevision.count({ where: { pageId: held } })).toBe(0);
    expect((await diagnostic(held))?.issues).toContain(
      "MISSING_MEDIA:pageDocument.blocks.0.props.mediaId",
    );
    await db.media.create({
      data: { id: prefix + "missing", url: "/synthetic", mime: "image/png" },
    });
    expect(await persistLegacyPageInDisposableDatabase(db, good)).toBe(
      "existing",
    );
    expect(await persistLegacyPageInDisposableDatabase(db, held)).toBe(
      "created",
    );
  });

  it("rolls back all page writes on a late database failure, then retries", async () => {
    const id = prefix + "rollback";
    await seed(id);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION b052b_reject_checkpoint() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."pageId" = 'b052b-rollback' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER b052b_failure BEFORE INSERT ON "ContentMigrationCheckpoint" FOR EACH ROW EXECUTE FUNCTION b052b_reject_checkpoint()`,
    );

    try {
      await expect(
        persistLegacyPageInDisposableDatabase(db, id),
      ).rejects.toThrow();
      expect(await db.contentRevision.count({ where: { pageId: id } })).toBe(0);
      expect(
        await db.contentEditorialState.count({ where: { pageId: id } }),
      ).toBe(0);
      expect(await db.contentDraft.count({ where: { pageId: id } })).toBe(0);
    } finally {
      await db.$executeRawUnsafe(
        `DROP TRIGGER b052b_failure ON "ContentMigrationCheckpoint"`,
      );
      await db.$executeRawUnsafe(`DROP FUNCTION b052b_reject_checkpoint()`);
    }
    expect(await persistLegacyPageInDisposableDatabase(db, id)).toBe("created");
  });

  it("detects changed source, target bodies, metadata, history and missing edges without overwriting", async () => {
    const id = prefix + "conflict";
    await seed(id);
    await persistLegacyPageInDisposableDatabase(db, id);
    await db.page.update({
      where: { id },
      data: { title: "Concurrent legacy change" },
    });
    expect((await diagnostic(id))?.issues).toEqual(
      expect.arrayContaining(["MISMATCH_CHECKPOINT", "MISMATCH_REVISIONS"]),
    );
    await expect(
      persistLegacyPageInDisposableDatabase(db, id),
    ).rejects.toMatchObject({ code: "EXISTING_TARGET_CONFLICT" });
    const historyId = prefix + "history";
    await db.contentRevisionMedia.deleteMany({
      where: { revision: { pageId: historyId } },
    });
    await db.contentRevision.updateMany({
      where: { pageId: historyId, number: 1 },
      data: { rawSource: "changed bytes" },
    });
    expect((await diagnostic(historyId))?.issues).toEqual(
      expect.arrayContaining(["MISMATCH_REVISIONS", "MISMATCH_MEDIA"]),
    );
    await expect(
      persistLegacyPageInDisposableDatabase(db, historyId),
    ).rejects.toMatchObject({ code: "EXISTING_TARGET_CONFLICT" });
    expect(JSON.stringify(await diagnostic(historyId))).not.toContain(
      "changed bytes",
    );
  });

  it("rejects partial target states and reports them without repair", async () => {
    const id = prefix + "partial";
    await seed(id);
    await db.contentRevision.create({
      data: {
        id: id + "-foreign",
        pageId: id,
        number: 1,
        schemaVersion: 1,
        rawSource: "existing editorial work",
        coverage: {},
        aggregateHash: "a".repeat(64),
        createdAt: new Date(),
        reason: "SAVE",
      },
    });
    expect(await diagnostic(id)).toMatchObject({ state: "conflict" });
    await expect(
      persistLegacyPageInDisposableDatabase(db, id),
    ).rejects.toMatchObject({ code: "EXISTING_TARGET_CONFLICT" });
  });

  it("refuses runtime execution regardless of concurrent writers or disposable identity", async () => {
    await expect(backfillLegacyContent({ db })).rejects.toMatchObject({
      code: "BACKFILL_FENCE_REQUIRED",
    });
  });

  it.each(["publication", "slug", "state", "body", "metadata", "checkpoint"])(
    "reconciles %s mismatches and refuses overwrite",
    async (kind) => {
      const id = prefix + "mismatch-" + kind;
      await seed(id, true);
      await persistLegacyPageInDisposableDatabase(db, id);

      switch (kind) {
        case "publication":
          await db.contentPublication.updateMany({
            where: { pageId: id },
            data: { displayedPublishedAt: new Date("2021-01-01T00:00:00Z") },
          });
          break;
        case "slug":
          await db.contentSlugReservation.updateMany({
            where: { pageId: id },
            data: { normalizedSlug: id + "-changed" },
          });
          break;
        case "state":
          await db.contentEditorialState.update({
            where: { pageId: id },
            data: { visibility: "PRIVATE" },
          });
          break;
        case "body":
          await db.contentRevision.updateMany({
            where: { pageId: id },
            data: { aggregate: { altered: "private body" } },
          });
          break;
        case "metadata":
          await db.contentRevision.updateMany({
            where: { pageId: id },
            data: { createdAt: new Date("2022-01-01T00:00:00Z") },
          });
          break;
        case "checkpoint":
          await db.contentMigrationCheckpoint.delete({ where: { pageId: id } });
          break;
      }
      expect(await diagnostic(id)).toMatchObject({ state: "conflict" });
      await expect(
        persistLegacyPageInDisposableDatabase(db, id),
      ).rejects.toMatchObject({ code: "EXISTING_TARGET_CONFLICT" });
      expect(JSON.stringify(await diagnostic(id))).not.toContain(
        "private body",
      );
    },
  );

  it("permits competing disposable transactions to create only one baseline", async () => {
    const id = prefix + "race";
    await seed(id);
    const outcomes = await Promise.allSettled([
      persistLegacyPageInDisposableDatabase(db, id),
      persistLegacyPageInDisposableDatabase(db, id),
    ]);
    expect(outcomes.some((outcome) => outcome.status === "fulfilled")).toBe(
      true,
    );
    expect(await db.contentRevision.count({ where: { pageId: id } })).toBe(1);
    expect(await persistLegacyPageInDisposableDatabase(db, id)).toBe(
      "existing",
    );
  });
});
