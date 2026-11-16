import { describe, expect, it } from "vitest";

import {
  ApiErrorSchema,
  PageSchema,
  PageUpdateSchema,
  TagIdsSchema,
} from "./api-contracts";
import { EMPTY_RICH_CONTENT, readRichContent } from "./content";
import {
  DraftPatchSchema,
  EditorialSnapshotSchema,
  readEditorialSnapshot,
  editorialHash,
  canonicalEditorialJson,
  EditorialVersionSchema,
  EditorialOperationIdSchema,
  RevisionCoverageSchema,
  RestoreProvenanceSchema,
  CreateDraftRequestSchema,
  SaveDraftRequestSchema,
  PublishRequestSchema,
  ScheduleRequestSchema,
  scheduleRequestSchemaAt,
  PublicationDeleteHeadersSchema,
  DraftDeleteHeadersSchema,
  EditorialErrorSchema,
  VersionConflictSchema,
  RevisionPageQuerySchema,
  EditorStateSchema,
  CompareRevisionFieldSchema,
  EditorialRevisionSchema,
} from "./editorial-contracts";
import { RevisionInputSchema, RevisionListSchema } from "./revisions";

const operationId = "e5b305ca-f327-4bfc-b265-1c863ee5d1c8";
const expected = {
  expectedContentVersion: 3,
  expectedDraftVersion: 8,
  operationId,
};
const snapshot = {
  schemaVersion: 1,
  fields: {
    title: "Title",
    slug: "title",
    excerpt: null,
    content: "Literal <script>alert(1)</script>",
    pageDocument: null,
    layout: "STANDARD",
    inHeaderMenu: true,
    inFooterMenu: false,
    parentId: "parent",
    listingKind: "EVENTS",
    listingTaxonomyId: "category",
    eventStart: "2026-03-29T01:30:00Z",
    eventEnd: "2026-10-25T01:30:00Z",
    eventLocation: "Hidden location",
    registrationUrl: "https://example.invalid/register",
    redirectTo: "/kept",
  },
  relationships: {
    coverId: "cover",
    tagIds: ["tag"],
    categoryIds: ["category"],
    gallery: [
      { mediaId: "second", sort: 0 },
      { mediaId: "first", sort: 1 },
    ],
  },
  extensions: { schemaVersion: 1, values: {} },
};

describe("versioned full snapshot and strict patch", () => {
  it("round trips every stored field, hidden properties and ordered relationships", () => {
    expect(EditorialSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(readEditorialSnapshot(JSON.stringify(snapshot))).toEqual({
      supported: true,
      snapshot,
    });
  });

  it.each([
    "authorId",
    "id",
    "type",
    "status",
    "publishedAt",
    "scheduledFor",
    "contentVersion",
    "draftVersion",
    "viewCount",
    "extensions",
  ])("rejects noneditable patch field %s", (key) => {
    expect(DraftPatchSchema.safeParse({ [key]: "forbidden" }).success).toBe(
      false,
    );
  });

  it("distinguishes omission, clear and replacement without defaults", () => {
    expect(DraftPatchSchema.parse({})).toEqual({});
    expect(DraftPatchSchema.parse({ coverId: null, categoryIds: [] })).toEqual({
      coverId: null,
      categoryIds: [],
    });
    expect(DraftPatchSchema.parse({ excerpt: null })).toEqual({
      excerpt: null,
    });
    expect(DraftPatchSchema.safeParse({ title: null }).success).toBe(false);
    expect(DraftPatchSchema.safeParse({ tagIds: null }).success).toBe(false);
    expect(
      DraftPatchSchema.parse({ gallery: snapshot.relationships.gallery })
        .gallery,
    ).toEqual(snapshot.relationships.gallery);
  });

  it.each([
    { tagIds: ["same"], categoryIds: ["same"] },
    { tagIds: ["tag", "tag"] },
    {
      categoryIds: Array.from(
        { length: 101 },
        (_, index) => `category-${index}`,
      ),
    },
    { coverId: "x".repeat(65) },
    { gallery: [{ mediaId: "id", sort: -1 }] },
    { redirectTo: "javascript:alert(1)" },
    { registrationUrl: "//evil.invalid" },
  ])("rejects invalid relationships or destinations %j", (patch) => {
    expect(DraftPatchSchema.safeParse(patch).success).toBe(false);
  });

  it("accepts supported document media and explicitly preserves unsupported raw data", () => {
    const document = {
      version: 1,
      blocks: [
        {
          id: "image",
          version: 1,
          type: "image",
          props: { mediaId: "image", alt: "Image" },
        },
      ],
    };
    expect(
      DraftPatchSchema.parse({ pageDocument: document }).pageDocument,
    ).toEqual(document);
    expect(
      DraftPatchSchema.safeParse({ pageDocument: { version: 2, blocks: [] } })
        .success,
    ).toBe(false);
    for (const value of [
      { ...snapshot, schemaVersion: 2 },
      {
        ...snapshot,
        fields: {
          ...snapshot.fields,
          pageDocument: { version: 99, future: true },
        },
      },
      {
        ...snapshot,
        fields: { ...snapshot.fields, futureStoredProperty: "retain" },
      },
      {
        ...snapshot,
        extensions: { schemaVersion: 2, values: { future: "retain" } },
      },
    ]) {
      const raw = `  ${JSON.stringify(value)}\n`;
      expect(readEditorialSnapshot(raw)).toMatchObject({
        supported: false,
        code: "UNSUPPORTED_SNAPSHOT",
        raw,
      });
    }
    expect(readEditorialSnapshot("invalid")).toMatchObject({
      supported: false,
      raw: "invalid",
    });
  });

  it("normalizes legacy rich input to literal text without trusting HTML", () => {
    expect(
      DraftPatchSchema.safeParse({ content: snapshot.fields.content }).success,
    ).toBe(false);
    const patch = DraftPatchSchema.parse({
      content: JSON.stringify(readRichContent(snapshot.fields.content)),
    });
    expect(JSON.parse(patch.content ?? "")).toMatchObject({
      blocks: [{ children: [{ text: snapshot.fields.content }] }],
    });
  });
});

it("keeps imported partial coverage truthful and records restore provenance", () => {
  const coverage = {
    kind: "legacy-partial",
    legacyRevisionId: "legacy",
    covered: ["title", "slug", "content", "excerpt", "layout", "pageDocument"],
    unsupported: ["unknown-extension"],
  };
  expect(RevisionCoverageSchema.parse(coverage)).toEqual(coverage);
  expect(
    RevisionCoverageSchema.safeParse({
      ...coverage,
      covered: ["title", "title"],
    }).success,
  ).toBe(false);
  const provenance = {
    sourceRevisionId: "historical",
    baseRevisionId: "current",
    inheritedFields: ["gallery", "categoryIds"],
    restoredFields: ["title"],
  };
  expect(RestoreProvenanceSchema.parse(provenance)).toEqual(provenance);
  expect(
    RestoreProvenanceSchema.safeParse({
      ...provenance,
      inheritedFields: ["title"],
    }).success,
  ).toBe(false);
});

it("never fabricates uncovered comparison values or actor metadata", () => {
  expect(
    CompareRevisionFieldSchema.parse({
      path: "excerpt",
      coverage: "from-only",
      before: null,
    }),
  ).toEqual({ path: "excerpt", coverage: "from-only", before: null });
  expect(
    CompareRevisionFieldSchema.safeParse({
      path: "gallery",
      coverage: "neither",
      before: [],
    }).success,
  ).toBe(false);
  expect(
    CompareRevisionFieldSchema.safeParse({
      path: "title",
      coverage: "both",
      before: "Old",
    }).success,
  ).toBe(false);
  const revision = {
    id: "immutable",
    number: 1,
    hash: "a".repeat(64),
    actor: null,
    createdAt: "2026-01-01T00:00:00Z",
    reason: "LEGACY_IMPORT",
    coverage: {
      kind: "legacy-partial",
      legacyRevisionId: "original",
      covered: ["title"],
      unsupported: [],
    },
    provenance: null,
  };
  expect(EditorialRevisionSchema.parse(revision)).toEqual(revision);
});

it.each([-1, 0.1, 2_147_483_647, Infinity, NaN, "1"])(
  "rejects invalid version %s",
  (value) => {
    expect(EditorialVersionSchema.safeParse(value).success).toBe(false);
  },
);

it("requires operation UUIDs and exact authoritative version inputs", () => {
  expect(EditorialVersionSchema.parse(0)).toBe(0);
  expect(EditorialVersionSchema.parse(2_147_483_646)).toBe(2_147_483_646);
  expect(EditorialOperationIdSchema.safeParse("retry").success).toBe(false);
  expect(
    CreateDraftRequestSchema.safeParse({ operationId, working: {} }).success,
  ).toBe(false);
  expect(
    CreateDraftRequestSchema.safeParse({
      operationId,
      working: { title: "New", slug: "new" },
    }).success,
  ).toBe(true);
  expect(
    SaveDraftRequestSchema.safeParse({
      ...expected,
      baseContentVersion: 3,
      patch: { title: "New" },
    }).success,
  ).toBe(true);
  expect(
    PublishRequestSchema.safeParse({ ...expected, revisionId: "immutable" })
      .success,
  ).toBe(true);
  expect(
    PublishRequestSchema.safeParse({
      ...expected,
      revisionId: "immutable",
      title: "Unsaved",
    }).success,
  ).toBe(false);
});

it("validates bodyless command headers and rejects duplicate/ambiguous numbers", () => {
  const headers = {
    "x-nextpress-content-version": "3",
    "x-nextpress-operation-id": operationId,
  };
  expect(PublicationDeleteHeadersSchema.parse(headers)).toEqual({
    ...headers,
    "x-nextpress-content-version": 3,
  });
  expect(DraftDeleteHeadersSchema.safeParse(headers).success).toBe(false);
  expect(
    DraftDeleteHeadersSchema.safeParse({
      ...headers,
      "x-nextpress-draft-version": "0",
    }).success,
  ).toBe(true);
  for (const value of [
    "-1",
    "01",
    "1.0",
    "3, 4",
    " 3",
    "2147483647",
    "1e2",
    "",
  ]) {
    expect(
      PublicationDeleteHeadersSchema.safeParse({
        ...headers,
        "x-nextpress-content-version": value,
      }).success,
    ).toBe(false);
  }
});

describe("offset-aware scheduling", () => {
  const schema = scheduleRequestSchemaAt(new Date("2026-01-01T00:00:00.000Z"));
  const command = { ...expected, revisionId: "frozen" };
  it.each([
    "2026-01-01T00:00:00.001Z",
    "2026-03-29T01:59:59+01:00",
    "2026-03-29T03:00:00+02:00",
    "2026-10-25T02:30:00+02:00",
    "2026-10-25T02:30:00+01:00",
  ])("accepts explicit instant %s", (scheduledFor) => {
    const result = schema.parse({
      ...command,
      scheduledFor,
      displayTimezone: "Europe/Budapest",
    });
    expect(result.scheduledFor).toBe(new Date(scheduledFor).toISOString());
  });
  it.each([
    "2026-01-01T00:00:00.000Z",
    "2025-12-31T23:59:59.999Z",
    "2026-03-29T02:30:00",
    "2026-10-25T02:30:00",
    "2026-02-30T00:00:00Z",
    "2026-06-01T00:00:00+25:00",
    "2026-06-01T00:00:00+0200",
  ])("rejects invalid/past/ambiguous input %s", (scheduledFor) => {
    expect(schema.safeParse({ ...command, scheduledFor }).success).toBe(false);
  });
  it("keeps overlap occurrences distinct; display zone never reinterprets UTC", () => {
    const a = schema.parse({
      ...command,
      scheduledFor: "2026-10-25T02:30:00+02:00",
    });
    const b = schema.parse({
      ...command,
      scheduledFor: "2026-10-25T02:30:00+01:00",
    });
    expect(Date.parse(b.scheduledFor) - Date.parse(a.scheduledFor)).toBe(
      3_600_000,
    );
    expect(
      ScheduleRequestSchema.safeParse({
        ...command,
        scheduledFor: "2026-06-01T00:00:00Z",
        displayTimezone: "invalid/zone",
      }).success,
    ).toBe(false);
  });
});

it("retains compatible errors and bounded revision cursors", () => {
  const legacy = {
    error: "Invalid",
    issues: [{ path: null, message: "Required" }],
  };
  expect(EditorialErrorSchema.parse(legacy)).toEqual(legacy);
  const conflict = {
    error: "Content changed",
    code: "VERSION_CONFLICT",
    versions: { contentVersion: 2, draftVersion: 8 },
  };
  expect(VersionConflictSchema.parse(conflict)).toEqual(conflict);
  expect(ApiErrorSchema.parse(conflict)).toEqual({ error: "Content changed" });
  expect(RevisionPageQuerySchema.parse({})).toEqual({ limit: 25 });
  for (const query of [
    { limit: 0 },
    { limit: 101 },
    { cursor: "" },
    { cursor: "x".repeat(513) },
    { cursor: "bad/cursor" },
  ]) {
    expect(RevisionPageQuerySchema.safeParse(query).success).toBe(false);
  }
});

it("returns independent accepted versions and private metadata, without increment assumptions", () => {
  const state = {
    contractVersion: 1,
    id: "item",
    kind: "PAGE",
    contentVersion: 3,
    draftVersion: 8,
    workingRevisionId: "revision",
    working: snapshot,
    baseContentVersion: 2,
    live: null,
    visibility: "PRIVATE",
    schedule: null,
    capabilities: {
      read: true,
      save: true,
      publish: false,
      unpublish: false,
      schedule: false,
      restore: true,
      discard: true,
      delete: false,
    },
    coverage: { kind: "complete", schemaVersion: 1 },
  };
  expect(EditorStateSchema.parse(state)).toEqual(state);
});

it("has canonical SHA-256 identity while retaining meaningful differences", async () => {
  expect(canonicalEditorialJson({ b: null, a: [2, 1] })).toBe(
    '{"a":[2,1],"b":null}',
  );
  expect(await editorialHash({ b: null, a: [2, 1] })).toBe(
    await editorialHash({ a: [2, 1], b: null }),
  );
  expect(await editorialHash({})).toBe(
    "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
  );
  expect(await editorialHash({})).not.toBe(await editorialHash({ a: null }));
  expect(await editorialHash(snapshot)).not.toBe(
    await editorialHash({
      ...snapshot,
      relationships: {
        ...snapshot.relationships,
        gallery: [...snapshot.relationships.gallery].reverse(),
      },
    }),
  );
  expect(() => canonicalEditorialJson({ a: undefined })).toThrow();
  expect(() => canonicalEditorialJson(Infinity)).toThrow();
});

it("leaves legacy create/update/tag/revision contracts unchanged", () => {
  expect(
    PageSchema.parse({
      title: "Old",
      slug: "old",
      type: "POST",
      status: "DRAFT",
    }),
  ).toMatchObject({ tagIds: [], content: EMPTY_RICH_CONTENT });
  expect(
    PageUpdateSchema.parse({ expectedVersion: 0, status: "PUBLISHED" }),
  ).toEqual({ expectedVersion: 0, status: "PUBLISHED" });
  expect(TagIdsSchema.parse(["tag"])).toEqual(["tag"]);
  const legacy = {
    title: "Old",
    slug: "old",
    content: EMPTY_RICH_CONTENT,
    excerpt: EMPTY_RICH_CONTENT,
    layout: "STANDARD",
    pageDocument: null,
  };
  expect(
    RevisionInputSchema.safeParse({ ...legacy, expectedVersion: 0 }).success,
  ).toBe(true);
  expect(
    RevisionListSchema.safeParse({ version: 0, current: legacy, revisions: [] })
      .success,
  ).toBe(true);
});
