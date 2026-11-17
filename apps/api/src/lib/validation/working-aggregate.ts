import { PageUpdateSchema } from "@nextpress/shared/api-contracts";
import {
  canonicalEditorialJson,
  EditorialReferenceSchema,
  EditorialSnapshotSchema,
  EditorialVersionSchema,
} from "@nextpress/shared/editorial-contracts";
import { readPageDocument } from "@nextpress/shared/page-document";
import { z } from "zod";

const publication = PageUpdateSchema.pick({
  status: true,
  publishedAt: true,
}).strict();

/** Internal preparation contract; no route or persistence capability is enabled. */
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
    inHeaderMenu: true,
    inFooterMenu: true,
    tagIds: true,
  }).strict(),
  publicationIntent: WorkingAggregateSchema.shape.publicationIntent.optional(),
});

export type WorkingAggregate = z.infer<typeof WorkingAggregateSchema>;
