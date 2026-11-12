import { z } from "zod";

import {
  ContentLayoutSchema,
  ContentSlugSchema,
  SerializedRichContentSchema,
} from "./content";
import { PageDocumentSchema } from "./page-document";

const workingVersion = z.number().int().min(0).max(2_147_483_646);

export const RevisionInputSchema = z.strictObject({
  expectedVersion: workingVersion,
  title: z.string().trim().min(1).max(300),
  slug: ContentSlugSchema,
  excerpt: SerializedRichContentSchema.pipe(z.string().max(10_000)),
  content: SerializedRichContentSchema,
  layout: ContentLayoutSchema,
  pageDocument: PageDocumentSchema.nullable(),
});

export const RevisionActionSchema = z.strictObject({
  expectedVersion: workingVersion,
  revisionId: z.string().min(1).max(64),
  action: z.enum(["restore", "publish", "unpublish"]),
});

export const RevisionSnapshotSchema = z.object({
  title: z.string(),
  slug: z.string(),
  content: z.string(),
  excerpt: z.string().nullable(),
  layout: ContentLayoutSchema,
  pageDocument: z.string().nullable(),
});
export const RevisionRecordSchema = RevisionSnapshotSchema.extend({
  id: z.string(),
  workingVersion: z.number().int(),
  createdAt: z.string(),
});
export const RevisionListSchema = z.object({
  version: z.number().int(),
  current: RevisionSnapshotSchema,
  revisions: z.array(RevisionRecordSchema),
});

// Preview carries content only: no credentials, persistence commands or navigation.
export const LivePreviewMessageSchema = z.strictObject({
  type: z.literal("nextpress:preview"),
  kind: z.enum(["pages", "posts"]).default("pages"),
  session: z.string().uuid(),
  snapshot: RevisionSnapshotSchema,
});

export const LivePreviewReadySchema = z.strictObject({
  type: z.literal("nextpress:ready"),
  session: z.string().uuid(),
});
