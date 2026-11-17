import { ContentLayoutSchema } from "@nextpress/shared/content";
import { describe, expect, it, vi } from "vitest";

import { WorkingAggregateSchema } from "@/lib/validation/working-aggregate";

import { mapEditorialReferenceEdges } from "./legacy-content-backfill.server";
import {
  assertWorkingAggregateBase,
  captureWorkingAggregate,
  prepareWorkingAggregateEdit,
  restoreLegacyWorkingAggregate,
  workingAggregateLegacyProjection,
  type LegacyAggregateSource,
} from "./working-aggregate";
import { workingPersistenceFailure } from "./working-persistence-errors";

vi.mock("@nextpress/db/src/client", () => ({ prisma: {} }));

it("reports unique content collisions as deterministic conflicts without adapter details", () => {
  expect(
    workingPersistenceFailure({ code: "P2002", meta: { target: ["slug"] } }),
  ).toBe("CONTENT_CONFLICT");
  expect(workingPersistenceFailure({ cause: { originalCode: "23505" } })).toBe(
    "CONTENT_CONFLICT",
  );
});

const instant = new Date("2020-01-02T03:04:05.006Z");
const actor = { id: "author", role: "AUTHOR" as const };

function source(
  overrides: Partial<LegacyAggregateSource> = {},
): LegacyAggregateSource {
  return {
    id: "page",
    type: "PAGE",
    authorId: "author",
    workingVersion: 4,
    title: "Original",
    slug: "original",
    content: "<p>Legacy bytes</p>",
    excerpt: null,
    pageDocument: '{ "version": 1, "blocks": [] }',
    layout: "EVENT_PAGE",
    status: "PUBLISHED",
    publishedAt: instant,
    coverId: "cover",
    inHeaderMenu: true,
    inFooterMenu: false,
    parentId: "parent",
    listingKind: "EVENTS",
    listingTaxonomyId: "category",
    eventStart: instant,
    eventEnd: null,
    eventLocation: "Historic location",
    registrationUrl: "legacy:value",
    redirectTo: "/old",
    gallery: [{ pageId: "page", mediaId: "cover", sort: 7 }],
    taxonomies: [
      {
        pageId: "page",
        taxonomyId: "tag",
        taxonomy: { id: "tag", type: "TAG", name: "Tag", slug: "tag" },
      },
      {
        pageId: "page",
        taxonomyId: "category",
        taxonomy: {
          id: "category",
          type: "CATEGORY",
          name: "Category",
          slug: "category",
        },
      },
    ],
    createdAt: instant,
    updatedAt: instant,
    viewCount: 30,
    uniqueViewCount: 10,
    likeCount: 2,
    lastViewedAt: instant,
    ...overrides,
  };
}

function edit(
  aggregate: ReturnType<typeof captureWorkingAggregate>,
  patch: unknown = {},
) {
  return {
    expectedVersion: aggregate.baseVersion,
    expectedFingerprint: aggregate.baseFingerprint,
    patch,
  };
}

describe("inactive working aggregate preparation", () => {
  it("restores only covered legacy fields, preserving raw bytes, private relationships and the current baseline", () => {
    const aggregate = captureWorkingAggregate(source());
    const historical = {
      id: "history",
      pageId: "page",
      authorId: "different-revision-actor",
      title: "Historical",
      slug: "historical",
      content: "Legacy bytes",
      excerpt: null,
      layout: "STANDARD" as const,
      pageDocument: '{ "version": 1, "blocks": [] }',
      workingVersion: 1,
      status: "DRAFT" as const,
      publishedAt: null,
      note: null,
      createdAt: instant,
    };
    const restored = restoreLegacyWorkingAggregate(aggregate, historical);
    expect(restored.snapshot.fields).toEqual({
      ...aggregate.snapshot.fields,
      title: historical.title,
      slug: historical.slug,
      content: historical.content,
      excerpt: null,
      layout: "STANDARD",
      pageDocument: { version: 1, blocks: [] },
    });
    expect(restored.snapshot.relationships).toEqual(
      aggregate.snapshot.relationships,
    );
    expect(restored.rawPageDocument).toBe(historical.pageDocument);
    expect(restored.baseFingerprint).toBe(aggregate.baseFingerprint);
    expect(restored.publicState).toEqual(aggregate.publicState);
    expect(restored.ownerId).toBe(aggregate.ownerId);
    expect(restored.publicationIntent).toEqual({ action: "PRESERVE" });
    expect(() =>
      restoreLegacyWorkingAggregate(aggregate, {
        ...historical,
        pageId: "other",
      }),
    ).toThrow("IDENTITY_CONFLICT");

    for (const pageDocument of ["", "not-json", '{"version":99,"blocks":[]}']) {
      expect(() =>
        restoreLegacyWorkingAggregate(aggregate, {
          ...historical,
          pageDocument,
        }),
      ).toThrow("UNSUPPORTED_LEGACY_REVISION");
    }
    expect(
      restoreLegacyWorkingAggregate(aggregate, {
        ...historical,
        pageDocument: null,
      }).rawPageDocument,
    ).toBeNull();
  });
  it("rejects inconsistent raw documents and empty publication commands", () => {
    const aggregate = captureWorkingAggregate(source());
    expect(() =>
      WorkingAggregateSchema.parse({ ...aggregate, rawPageDocument: null }),
    ).toThrow();
    expect(() =>
      prepareWorkingAggregateEdit(
        aggregate,
        {
          ...edit(aggregate),
          publicationIntent: { action: "CHANGE" },
        },
        actor,
      ),
    ).toThrow();
  });

  it.each(["PAGE", "POST"] as const)(
    "round trips the full %s aggregate and original document bytes",
    (type) => {
      const initial = captureWorkingAggregate(source({ type }));
      let aggregate = initial;

      for (let cycle = 0; cycle < 4; cycle++) {
        aggregate = WorkingAggregateSchema.parse(
          JSON.parse(JSON.stringify(aggregate)),
        );
        aggregate = prepareWorkingAggregateEdit(
          aggregate,
          edit(aggregate),
          actor,
        );
      }
      expect(aggregate).toEqual(initial);
      expect(workingAggregateLegacyProjection(aggregate)).toMatchObject({
        type,
        excerpt: null,
        coverId: "cover",
        tagIds: ["tag"],
        categoryIds: ["category"],
        gallery: [{ mediaId: "cover", sort: 7 }],
        inHeaderMenu: true,
        parentId: "parent",
        publishedAt: instant.toISOString(),
        eventStart: instant.toISOString(),
        eventEnd: null,
        pageDocument: source().pageDocument,
        registrationUrl: "legacy:value",
      });
      expect(JSON.stringify(aggregate)).not.toMatch(
        /viewCount|likeCount|lastViewedAt|createdAt/,
      );
    },
  );

  it.each(ContentLayoutSchema.options)(
    "preserves historical %s values on supported edits",
    (layout) => {
      const aggregate = captureWorkingAggregate(source({ layout }));
      const changed = prepareWorkingAggregateEdit(
        aggregate,
        edit(aggregate, { title: "New" }),
        actor,
      );
      expect(changed.snapshot.fields).toEqual({
        ...aggregate.snapshot.fields,
        title: "New",
      });
      expect(changed.snapshot.relationships).toEqual(
        aggregate.snapshot.relationships,
      );
      expect(changed.publicState).toEqual(aggregate.publicState);
      expect(aggregate.snapshot.fields.title).toBe("Original");
    },
  );

  it("distinguishes publication omission and explicit null without publishing on save", () => {
    const aggregate = captureWorkingAggregate(source());
    const change = prepareWorkingAggregateEdit(
      aggregate,
      {
        ...edit(aggregate),
        publicationIntent: {
          action: "CHANGE",
          status: "PUBLISHED",
          publishedAt: null,
        },
      },
      actor,
    );
    expect(change.publicState).toEqual(aggregate.publicState);
    expect(change.publicationIntent).toEqual({
      action: "CHANGE",
      status: "PUBLISHED",
      publishedAt: null,
    });
    expect(
      prepareWorkingAggregateEdit(aggregate, edit(aggregate), actor)
        .publicationIntent,
    ).toEqual({ action: "PRESERVE" });
    expect(() =>
      prepareWorkingAggregateEdit(
        aggregate,
        edit(aggregate, { title: null }),
        actor,
      ),
    ).toThrow();
    expect(() =>
      WorkingAggregateSchema.parse({ ...aggregate, ownerId: undefined }),
    ).toThrow();
  });

  it.each([
    "coverId",
    "parentId",
    "eventStart",
    "categoryIds",
    "gallery",
    "ownerId",
    "status",
  ])("rejects unsupported patch field %s", (field) => {
    const aggregate = captureWorkingAggregate(source());
    expect(() =>
      prepareWorkingAggregateEdit(
        aggregate,
        edit(aggregate, { [field]: null }),
        actor,
      ),
    ).toThrow();
  });

  it("rejects stale scalar and revision versions", () => {
    const aggregate = captureWorkingAggregate(source());
    expect(() =>
      prepareWorkingAggregateEdit(
        aggregate,
        { ...edit(aggregate), expectedVersion: 3 },
        actor,
      ),
    ).toThrow();
    expect(() =>
      assertWorkingAggregateBase(aggregate, source({ workingVersion: 5 })),
    ).toThrow();
  });

  it("detects unversioned joins, ownership, dates and raw document changes", () => {
    const aggregate = captureWorkingAggregate(source());

    for (const override of [
      { taxonomies: [] },
      { gallery: [] },
      { authorId: "other" },
      { publishedAt: null },
      { pageDocument: '{"version":1,"blocks":[]}' },
    ]) {
      expect(() =>
        assertWorkingAggregateBase(aggregate, source(override)),
      ).toThrow();
    }
    expect(() =>
      assertWorkingAggregateBase(aggregate, source({ viewCount: 31 })),
    ).not.toThrow();
  });

  it("normalizes relation ordering for stable comparison", () => {
    const aggregate = captureWorkingAggregate(source());
    expect(() =>
      assertWorkingAggregateBase(
        aggregate,
        source({ taxonomies: source().taxonomies.reverse() }),
      ),
    ).not.toThrow();
  });

  it.each(["SUBSCRIBER", null] as const)("denies %s edits", (role) => {
    const aggregate = captureWorkingAggregate(source());
    expect(() =>
      prepareWorkingAggregateEdit(aggregate, edit(aggregate), {
        id: "author",
        role,
      }),
    ).toThrow();
  });

  it("denies other authors and allows editors without changing ownership", () => {
    const aggregate = captureWorkingAggregate(source());
    expect(() =>
      prepareWorkingAggregateEdit(aggregate, edit(aggregate), {
        id: "other",
        role: "AUTHOR",
      }),
    ).toThrow();
    expect(
      prepareWorkingAggregateEdit(aggregate, edit(aggregate), {
        id: "editor",
        role: "EDITOR",
      }).ownerId,
    ).toBe("author");
  });

  it.each(["", "not-json", '{"version":99,"blocks":[]}'])(
    "fails closed on unsupported stored document %s",
    (pageDocument) => {
      expect(() => captureWorkingAggregate(source({ pageDocument }))).toThrow();
    },
  );

  it("preserves null documents and undated historical publication", () => {
    const aggregate = captureWorkingAggregate(
      source({ pageDocument: null, publishedAt: null }),
    );
    expect(workingAggregateLegacyProjection(aggregate)).toMatchObject({
      pageDocument: null,
      status: "PUBLISHED",
      publishedAt: null,
    });
  });

  it("reuses complete reference indexing and reports every missing target", () => {
    const aggregate = captureWorkingAggregate(source());
    const targets = {
      mediaIds: new Set(["cover"]),
      taxonomyIds: new Set(["tag", "category"]),
      pageIds: new Set(["parent"]),
      userIds: new Set(["author"]),
    };
    expect(
      mapEditorialReferenceEdges("revision", aggregate.snapshot, targets)
        .issues,
    ).toEqual([]);
    const missing = mapEditorialReferenceEdges("revision", aggregate.snapshot, {
      ...targets,
      mediaIds: new Set(),
      taxonomyIds: new Set(),
      pageIds: new Set(),
    });
    expect(missing.issues).toEqual(
      expect.arrayContaining([
        "MISSING_MEDIA:coverId",
        "MISSING_PAGE:parentId",
        "MISSING_TAXONOMY:TAG:0",
        "MISSING_TAXONOMY:CATEGORY:0",
        "MISSING_TAXONOMY:LISTING:0",
      ]),
    );
  });
});
