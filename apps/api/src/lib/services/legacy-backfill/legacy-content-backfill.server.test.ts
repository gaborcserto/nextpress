import { prisma } from "@nextpress/db/src/client";
import { describe, expect, it, vi } from "vitest";

import { mapEditorialReferenceEdges } from "../editorial-mapping";
import { verifyBackfillDatabase } from "./legacy-backfill-fence.server";
import {
  backfillLegacyContent,
  mapLegacyRevisionHistory,
} from "./legacy-content-backfill.server";
import { persistLegacyPageInDisposableDatabase } from "../../testing/legacy-backfill-persistence";

import type { PageRevision } from "@nextpress/db/generated/prisma/client";

vi.mock("@nextpress/db/src/client", () => ({ prisma: {} }));

const targets = {
  userIds: new Set(["author"]),
  mediaIds: new Set(["image"]),
  taxonomyIds: new Set(["tag"]),
  pageIds: new Set(["parent"]),
};
const document = {
  version: 1,
  blocks: [
    {
      id: "columns",
      version: 1,
      type: "columns",
      props: {},
      regions: [
        [
          {
            id: "image",
            version: 1,
            type: "image",
            props: { mediaId: "image", alt: "" },
          },
        ],
        [
          {
            id: "listing",
            version: 1,
            type: "content-listing",
            props: { kind: "POST", limit: 5, taxonomyId: "tag" },
          },
        ],
      ],
    },
  ],
};

function revision(overrides: Partial<PageRevision> = {}): PageRevision {
  return {
    id: "revision",
    pageId: "page",
    authorId: "author",
    title: "Historical title",
    slug: "original-slug",
    excerpt: null,
    content: "<p>Original bytes</p>",
    pageDocument: JSON.stringify(document),
    workingVersion: 2,
    layout: "STANDARD",
    status: "DRAFT",
    publishedAt: null,
    note: "Saved draft",
    createdAt: new Date("2020-01-02T00:00:00Z"),
    ...overrides,
  };
}

describe("legacy historical mapping", () => {
  it("requires independent runtime target configuration even with caller-supplied ownership", async () => {
    try {
      vi.stubEnv("NEXTPRESS_BACKFILL_DATABASE_NAME", "");
      await expect(
        backfillLegacyContent({
          db: prisma,
          ownership: {
            owner: "00000000-0000-4000-8000-000000000001",
            generation: 1n,
          },
          pageIds: ["page"],
        }),
      ).rejects.toMatchObject({ code: "BACKFILL_IDENTITY_REQUIRED" });
      vi.stubEnv("NEXTPRESS_BACKFILL_DATABASE_NAME", "cms");
      vi.stubEnv("NEXTPRESS_BACKFILL_CLUSTER_ID", "123");
      vi.stubEnv("NEXTPRESS_BACKFILL_DATABASE_ROLE", "runtime");
      await expect(verifyBackfillDatabase(prisma)).rejects.toMatchObject({
        code: "BACKFILL_IDENTITY_REQUIRED",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("refuses the isolated writer outside tests or without independent disposable identity", async () => {
    try {
      vi.stubEnv("NODE_ENV", "development");
      await expect(
        persistLegacyPageInDisposableDatabase(prisma, "page"),
      ).rejects.toMatchObject({ code: "ISOLATED_TEST_ONLY" });
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv(
        "NEXTPRESS_CONTENT_TEST_DATABASE_URL",
        "postgresql://b04_runtime:synthetic@127.0.0.1:55432/cms",
      );
      vi.stubEnv(
        "DATABASE_URL",
        "postgresql://b04_runtime:synthetic@127.0.0.1:55432/cms",
      );
      await expect(
        persistLegacyPageInDisposableDatabase(prisma, "page"),
      ).rejects.toThrow(
        "Only explicitly designated local disposable databases are allowed",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("preserves available metadata and raw bytes without inventing complete history", () => {
    const source = revision({
      status: "PUBLISHED",
      publishedAt: new Date("2020-01-01T00:00:00Z"),
    });
    const [mapped] = mapLegacyRevisionHistory("page", [source], targets);
    expect(mapped?.state).toBe("pending");
    expect(mapped?.revision.id.length).toBeLessThanOrEqual(64);
    expect(mapped?.revision).toMatchObject({
      pageId: "page",
      actorId: "author",
      createdAt: source.createdAt,
      reason: "LEGACY_IMPORT",
      coverage: { kind: "legacy-partial", legacyRevisionId: source.id },
    });
    const raw = JSON.parse(mapped!.revision.rawSource);
    expect(raw).toEqual({
      ...source,
      createdAt: source.createdAt.toISOString(),
      publishedAt: source.publishedAt?.toISOString(),
    });
    expect(mapped?.revision).not.toHaveProperty("aggregate");
    expect(mapped?.revision).not.toHaveProperty("sourceRevisionId");
    expect(mapped?.edges.pages).toEqual([]);
    expect(mapped?.edges.media).toEqual([
      {
        revisionId: mapped?.revision.id,
        mediaId: "image",
        usage: "DOCUMENT",
        position: 0,
        path: "pageDocument.blocks.0.regions.0.0.props.mediaId",
      },
    ]);
    expect(mapped?.edges.taxonomies).toEqual([
      {
        revisionId: mapped?.revision.id,
        taxonomyId: "tag",
        usage: "LISTING",
        position: 0,
      },
    ]);
  });

  it("orders by working version, timestamp, then identity independently of input order", () => {
    const sources = [
      revision({ id: "z" }),
      revision({ id: "a" }),
      revision({ id: "first", workingVersion: 1 }),
    ];
    const mapped = mapLegacyRevisionHistory("page", sources, targets);
    expect(mapped.map((item) => item.importRecord.legacyRevisionId)).toEqual([
      "first",
      "a",
      "z",
    ]);
    expect(mapped.map((item) => item.revision.number)).toEqual([1, 2, 3]);
    expect(
      mapLegacyRevisionHistory("page", sources.reverse(), targets),
    ).toEqual(mapped);
  });

  it("distinguishes empty history and absent documents from unsupported documents", () => {
    expect(mapLegacyRevisionHistory("page", [], targets)).toEqual([]);
    const [absent] = mapLegacyRevisionHistory(
      "page",
      [revision({ pageDocument: null, authorId: null })],
      targets,
    );
    expect(absent?.state).toBe("pending");
    expect(absent?.edges).toEqual({ media: [], taxonomies: [], pages: [] });

    for (const pageDocument of [
      "{broken",
      '{"version":99,"blocks":[]}',
      "x".repeat(1_000_001),
    ]) {
      const [mapped] = mapLegacyRevisionHistory(
        "page",
        [revision({ pageDocument })],
        targets,
      );
      expect(mapped?.state).toBe("held");
      expect(mapped?.issues).toContain("UNSUPPORTED_PAGE_DOCUMENT");
      expect(JSON.parse(mapped!.revision.rawSource).pageDocument).toBe(
        pageDocument,
      );
      expect(mapped?.revision.coverage).toMatchObject({
        unsupported: ["UNSUPPORTED_PAGE_DOCUMENT"],
      });
    }
  });

  it("holds deleted references and authors while retaining their original source identities", () => {
    const [mapped] = mapLegacyRevisionHistory("page", [revision()], {
      userIds: new Set(),
      mediaIds: new Set(),
      taxonomyIds: new Set(),
      pageIds: new Set(),
    });
    expect(mapped?.state).toBe("held");
    expect(mapped?.issues).toEqual([
      "MISSING_MEDIA:pageDocument.blocks.0.regions.0.0.props.mediaId",
      "MISSING_TAXONOMY:LISTING:0",
      "MISSING_AUTHOR",
    ]);
    expect(mapped?.revision.actorId).toBeNull();
    expect(JSON.parse(mapped!.revision.rawSource).authorId).toBe("author");
    expect(mapped?.edges).toEqual({ media: [], taxonomies: [], pages: [] });
  });

  it("reuses deterministic import identities and detects changed source and import ownership", () => {
    const source = revision();
    const [initial] = mapLegacyRevisionHistory("page", [source], targets);
    const imported = { ...initial!.importRecord, importedAt: new Date() };
    expect(
      mapLegacyRevisionHistory("page", [source], targets, [imported])[0]?.state,
    ).toBe("existing");

    for (const change of [
      { sourceHash: "bad" },
      { revisionId: "other" },
      { pageId: "other" },
      { adapterVersion: 99 },
    ]) {
      expect(
        mapLegacyRevisionHistory("page", [source], targets, [
          { ...imported, ...change },
        ])[0]?.issues,
      ).toContain("HISTORY_IMPORT_CONFLICT");
    }

    expect(
      mapLegacyRevisionHistory(
        "page",
        [revision({ content: "changed" })],
        targets,
        [imported],
      )[0]?.state,
    ).toBe("held");
    expect(() =>
      mapLegacyRevisionHistory("other", [source], targets),
    ).toThrow();
    expect(() =>
      mapLegacyRevisionHistory("page", [source, source], targets),
    ).toThrow();
  });

  it("maps current relationship edges and deduplicates listing references", () => {
    const result = mapEditorialReferenceEdges(
      "r",
      {
        fields: {
          pageDocument: { version: 1, blocks: [] },
          parentId: "parent",
          listingTaxonomyId: "tag",
        },
        relationships: {
          coverId: "image",
          gallery: [{ mediaId: "image", sort: 3 }],
          tagIds: ["tag"],
          categoryIds: [],
        },
      },
      targets,
    );
    expect(result.issues).toEqual([]);
    expect(result.edges.media.map((edge) => edge.usage)).toEqual([
      "COVER",
      "GALLERY",
    ]);
    expect(result.edges.taxonomies.map((edge) => edge.usage)).toEqual([
      "TAG",
      "LISTING",
    ]);
    expect(result.edges.pages).toEqual([
      {
        revisionId: "r",
        targetPageId: "parent",
        usage: "PARENT",
        path: "parentId",
      },
    ]);
  });

  it("refuses execution before accessing the database", async () => {
    await expect(backfillLegacyContent({})).rejects.toMatchObject({
      code: "BACKFILL_FENCE_REQUIRED",
    });
  });

  it("retains media occurrences while deduplicating repeated listing taxonomy edges", () => {
    const pageDocument = JSON.stringify({
      version: 1,
      blocks: [
        {
          id: "a",
          type: "image",
          version: 1,
          props: { mediaId: "image", alt: "" },
        },
        {
          id: "b",
          type: "image",
          version: 1,
          props: { mediaId: "image", alt: "" },
        },
        {
          id: "c",
          type: "content-listing",
          version: 1,
          props: { kind: "POST", limit: 1, taxonomyId: "tag" },
        },
        {
          id: "d",
          type: "content-listing",
          version: 1,
          props: { kind: "POST", limit: 1, taxonomyId: "tag" },
        },
      ],
    });
    const [mapped] = mapLegacyRevisionHistory(
      "page",
      [revision({ pageDocument })],
      targets,
    );
    expect(mapped?.edges.media).toHaveLength(2);
    expect(mapped?.edges.media.map((item) => item.path)).toEqual([
      "pageDocument.blocks.0.props.mediaId",
      "pageDocument.blocks.1.props.mediaId",
    ]);
    expect(mapped?.edges.taxonomies).toHaveLength(1);
    expect(
      mapLegacyRevisionHistory("page", [revision({ pageDocument })], targets),
    ).toEqual([mapped]);
  });

  it("reports missing current references without emitting invalid foreign keys", () => {
    const mapped = mapEditorialReferenceEdges(
      "r",
      {
        fields: {
          parentId: "deleted",
          listingTaxonomyId: "deleted",
          pageDocument: null,
        },
        relationships: {
          coverId: "deleted",
          gallery: [{ mediaId: "deleted", sort: 0 }],
          tagIds: ["deleted"],
          categoryIds: ["deleted"],
        },
      },
      targets,
    );
    expect(mapped.edges).toEqual({ media: [], taxonomies: [], pages: [] });
    expect(mapped.issues).toEqual([
      "MISSING_MEDIA:coverId",
      "MISSING_MEDIA:gallery.0",
      "MISSING_TAXONOMY:TAG:0",
      "MISSING_TAXONOMY:CATEGORY:0",
      "MISSING_PAGE:parentId",
      "MISSING_TAXONOMY:LISTING:0",
    ]);
  });
});
