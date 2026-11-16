import { z } from "zod";

import { PageSchema, TagIdsSchema } from "./api-contracts";
import { ContentLayoutSchema, SerializedRichContentSchema } from "./content";
import { PageDestinationSchema, PageDocumentSchema } from "./page-document";

export const EditorialReferenceSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const EditorialVersionSchema = z
  .number()
  .int()
  .min(0)
  .max(2_147_483_646);
export const EditorialOperationIdSchema = z.uuid();
const instant = z.iso.datetime({ offset: true });
const nullableReference = EditorialReferenceSchema.nullable();
const relationshipIds = TagIdsSchema.removeDefault();
const storedRelationshipIds = z
  .array(z.string())
  .refine(
    (ids) => ids.every((id) => id === id.trim()),
    "Stored references must not require normalization",
  )
  .pipe(relationshipIds);
const gallery = z
  .array(
    z.strictObject({
      mediaId: EditorialReferenceSchema,
      sort: z.number().int().min(0).max(2_147_483_646),
    }),
  )
  .max(100)
  .refine(
    (items) => new Set(items.map((item) => item.mediaId)).size === items.length,
    "Duplicate gallery media",
  );

const storedFields = {
  title: z.string(),
  slug: z.string(),
  excerpt: z.string().nullable(),
  content: z.string(),
  pageDocument: PageDocumentSchema.nullable(),
  layout: ContentLayoutSchema,
  inHeaderMenu: z.boolean(),
  inFooterMenu: z.boolean(),
  parentId: nullableReference,
  listingKind: z.enum(["POSTS", "PRODUCTS", "EVENTS"]).nullable(),
  listingTaxonomyId: nullableReference,
  eventStart: instant.nullable(),
  eventEnd: instant.nullable(),
  eventLocation: z.string().nullable(),
  registrationUrl: z.string().nullable(),
  redirectTo: z.string().nullable(),
};
const relationships = {
  coverId: nullableReference,
  tagIds: storedRelationshipIds,
  categoryIds: storedRelationshipIds,
  gallery,
};

function distinctTaxonomyTypes(value: {
  tagIds?: string[];
  categoryIds?: string[];
}) {
  return !value.tagIds?.some((id) => value.categoryIds?.includes(id));
}

/** No extension features are supported yet. Unknown stored envelopes require preservation. */
export const EditorialSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  fields: z.strictObject(storedFields),
  relationships: z
    .strictObject(relationships)
    .refine(distinctTaxonomyTypes, "TAG and CATEGORY IDs must be disjoint"),
  extensions: z.strictObject({
    schemaVersion: z.literal(1),
    values: z.strictObject({}),
  }),
});
export type EditorialSnapshot = z.infer<typeof EditorialSnapshotSchema>;

// Existing content validation owns rich-text normalization. Stored snapshots retain raw text.
export const DraftPatchSchema = z
  .strictObject({
    ...storedFields,
    ...relationships,
    tagIds: relationshipIds,
    categoryIds: relationshipIds,
    title: PageSchema.shape.title,
    eventLocation: z.string().max(2000).nullable(),
    registrationUrl: PageDestinationSchema.nullable(),
    redirectTo: PageDestinationSchema.nullable(),
    slug: PageSchema.shape.slug,
    content: SerializedRichContentSchema,
    excerpt: SerializedRichContentSchema.pipe(
      z.string().max(10_000),
    ).nullable(),
  })
  .partial()
  .refine(distinctTaxonomyTypes, "TAG and CATEGORY IDs must be disjoint");
export type DraftPatch = z.infer<typeof DraftPatchSchema>;

export const EditorialFieldSchema = z.enum([
  "title",
  "slug",
  "excerpt",
  "content",
  "pageDocument",
  "layout",
  "inHeaderMenu",
  "inFooterMenu",
  "parentId",
  "listingKind",
  "listingTaxonomyId",
  "eventStart",
  "eventEnd",
  "eventLocation",
  "registrationUrl",
  "redirectTo",
  "coverId",
  "tagIds",
  "categoryIds",
  "gallery",
  "extensions",
]);
const fieldSet = z
  .array(EditorialFieldSchema)
  .max(21)
  .refine(
    (fields) => new Set(fields).size === fields.length,
    "Duplicate coverage field",
  );
export const RevisionCoverageSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("complete"), schemaVersion: z.literal(1) }),
  z.strictObject({
    kind: z.literal("legacy-partial"),
    legacyRevisionId: EditorialReferenceSchema,
    covered: fieldSet,
    unsupported: z.array(z.string().min(1).max(128)).max(100),
  }),
]);
export const RestoreProvenanceSchema = z
  .strictObject({
    sourceRevisionId: EditorialReferenceSchema,
    baseRevisionId: EditorialReferenceSchema,
    inheritedFields: fieldSet,
    restoredFields: fieldSet,
  })
  .refine(
    (value) =>
      !value.inheritedFields.some((field) =>
        value.restoredFields.includes(field),
      ),
    "Restored and inherited fields must be disjoint",
  );

export type SnapshotReadResult =
  | { supported: true; snapshot: EditorialSnapshot }
  | {
      supported: false;
      code: "UNSUPPORTED_SNAPSHOT";
      raw: string;
      unsupported: string[];
    };

/** Raw source is retained byte-for-byte on every unsupported format or stored field. */
export function readEditorialSnapshot(raw: string): SnapshotReadResult {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return {
      supported: false,
      code: "UNSUPPORTED_SNAPSHOT",
      raw,
      unsupported: ["invalid-json"],
    };
  }
  const result = EditorialSnapshotSchema.safeParse(value);

  if (!result.success) {
    return {
      supported: false,
      code: "UNSUPPORTED_SNAPSHOT",
      raw,
      unsupported: result.error.issues.map(
        (issue) => issue.path.join(".") || "snapshot",
      ),
    };
  }

  return { supported: true, snapshot: result.data };
}

/** UTF-8 JSON, lexicographic object keys; no date, whitespace, array or Unicode normalization. */
export function canonicalEditorialJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${Array.from(value, canonicalEditorialJson).join(",")}]`;
  }

  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${canonicalEditorialJson(item)}`,
      )
      .join(",")}}`;
  }
  throw new Error("Canonical editorial values must be finite JSON");
}

export async function editorialHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalEditorialJson(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
