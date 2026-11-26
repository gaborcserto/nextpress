import { z } from "zod";

import { PageUpdateSchema, TagSchema } from "../api-contracts";
import {
  canonicalEditorialJson,
  EditorialReferenceSchema,
  EditorialSnapshotSchema,
  EditorialVersionSchema,
} from "./editorial-contracts";
import { readPageDocument } from "./page-document";

const publication = PageUpdateSchema.pick({
  status: true,
  publishedAt: true,
}).strict();

/** Canonical private aggregate; public delivery must never use this envelope. */
export const WorkingAggregateSchema = z
  .strictObject({
    contractVersion: z.literal(1),
    pageId: EditorialReferenceSchema,
    kind: z.enum(["PAGE", "POST"]),
    ownerId: EditorialReferenceSchema.nullable(),
    baseVersion: EditorialVersionSchema,
    baseFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    snapshot: EditorialSnapshotSchema,
    rawPageDocument: z.string().nullable(),
    savedAt: z.iso.datetime({ offset: true }).optional(),
    publicState: z.strictObject({
      status: z.enum(["DRAFT", "PUBLISHED"]),
      publishedAt: z.iso.datetime({ offset: true }).nullable(),
    }),
    publicationIntent: z.discriminatedUnion("action", [
      z.strictObject({ action: z.literal("PRESERVE") }),
      z
        .strictObject({ action: z.literal("CHANGE"), ...publication.shape })
        .refine(
          (intent) =>
            intent.status !== undefined || intent.publishedAt !== undefined,
          "Publication change requires explicit status or date",
        ),
    ]),
    release: z
      .strictObject({
        id: z.uuid(),
        pinnedVersion: z.number().int().positive(),
        actorId: EditorialReferenceSchema,
        actorRole: z.enum(["ADMIN", "EDITOR", "AUTHOR"]),
        scheduledFor: z.iso.datetime({ offset: true }),
        state: z.enum(["PENDING", "CANCELLED", "EXECUTED"]),
      })
      .optional(),
    receipt: z
      .strictObject({
        operation: z.enum([
          "PUBLISH",
          "UNPUBLISH",
          "SCHEDULE",
          "CANCEL_SCHEDULE",
          "EXECUTE",
        ]),
        requestId: z.uuid(),
        actorId: EditorialReferenceSchema,
        pinnedVersion: z.number().int().nonnegative(),
        acceptedAt: z.iso.datetime({ offset: true }),
        supersededReleaseId: z.uuid().optional(),
      })
      .optional(),
  })
  .refine((aggregate) => {
    if (aggregate.rawPageDocument === null) {
      return aggregate.snapshot.fields.pageDocument === null;
    }

    try {
      const parsed = readPageDocument(aggregate.rawPageDocument);

      return (
        parsed.supported &&
        canonicalEditorialJson(parsed.document) ===
          canonicalEditorialJson(aggregate.snapshot.fields.pageDocument)
      );
    } catch {
      return false;
    }
  }, "Raw document and snapshot must represent the same supported document");

// Preserve broader snapshot fields, but only accept edits supported by today's live API.
export const WorkingAggregateEditSchema = z.strictObject({
  expectedVersion: EditorialVersionSchema,
  expectedFingerprint: WorkingAggregateSchema.shape.baseFingerprint,
  patch: PageUpdateSchema.pick({
    title: true,
    slug: true,
    content: true,
    excerpt: true,
    layout: true,
    listingTaxonomyId: true,
    inHeaderMenu: true,
    inFooterMenu: true,
    tagIds: true,
  }).strict(),
  publicationIntent: WorkingAggregateSchema.shape.publicationIntent.optional(),
});

export type WorkingAggregate = z.infer<typeof WorkingAggregateSchema>;

export const WorkingAggregateSaveSchema = z.strictObject({
  pageId: z.string().min(1).max(191),
  requestId: z.uuid(),
  expectedDraftVersion: z.number().int().nonnegative(),
  expectedSourceVersion: z.number().int().nonnegative(),
  edit: WorkingAggregateEditSchema,
  operation: z
    .enum([
      "RESET",
      "RESTORE",
      "RESTORE_LEGACY",
      "PUBLISH",
      "UNPUBLISH",
      "SCHEDULE",
      "CANCEL_SCHEDULE",
      "EXECUTE",
    ])
    .optional(),
  scheduledFor: z.iso.datetime({ offset: true }).optional(),
  restoreVersion: z.number().int().positive().optional(),
  legacyRevisionId: EditorialReferenceSchema.optional(),
});

export const WorkingAggregateEnvelopeSchema = z.strictObject({
  version: z.number().int().nonnegative(),
  sourceVersion: z.number().int().nonnegative(),
  aggregate: WorkingAggregateSchema,
  currentSourceVersion: z.number().int().nonnegative().optional(),
  pendingPrivateChanges: z.boolean().optional(),
  tagLabels: z.array(TagSchema).optional(),
  history: z
    .array(
      z.strictObject({
        version: z.number().int().positive(),
        title: z.string(),
      }),
    )
    .max(100)
    .optional(),
  legacyHistory: z
    .array(
      z.strictObject({
        id: EditorialReferenceSchema,
        title: z.string(),
        createdAt: z.iso.datetime({ offset: true }),
      }),
    )
    .max(100)
    .optional(),
});

export type WorkingAggregateEnvelope = z.infer<
  typeof WorkingAggregateEnvelopeSchema
>;
export type WorkingAggregateSave = z.infer<typeof WorkingAggregateSaveSchema>;
export type WorkingPatch = z.infer<typeof WorkingAggregateEditSchema>["patch"];
