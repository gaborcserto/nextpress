import { z } from "zod";

import { ApiErrorSchema } from "../api-contracts";
import {
  DraftPatchSchema,
  EditorialOperationIdSchema,
  EditorialReferenceSchema,
  EditorialSnapshotSchema,
  EditorialVersionSchema,
  RevisionCoverageSchema,
  RestoreProvenanceSchema,
  EditorialFieldSchema,
} from "./editorial-snapshot";

export {
  canonicalEditorialJson,
  DraftPatchSchema,
  EditorialFieldSchema,
  editorialHash,
  EditorialOperationIdSchema,
  EditorialReferenceSchema,
  EditorialSnapshotSchema,
  EditorialVersionSchema,
  readEditorialSnapshot,
  RestoreProvenanceSchema,
  RevisionCoverageSchema,
} from "./editorial-snapshot";
export type {
  DraftPatch,
  EditorialSnapshot,
  SnapshotReadResult,
} from "./editorial-snapshot";

const instant = z.iso.datetime({ offset: true });
export const ExpectedEditorialVersionsSchema = z.strictObject({
  expectedContentVersion: EditorialVersionSchema,
  expectedDraftVersion: EditorialVersionSchema,
});
const command = {
  ...ExpectedEditorialVersionsSchema.shape,
  operationId: EditorialOperationIdSchema,
};
const revisionCommand = { ...command, revisionId: EditorialReferenceSchema };
export const CreateDraftRequestSchema = z.strictObject({
  operationId: EditorialOperationIdSchema,
  working: DraftPatchSchema.refine(
    (patch) => patch.title !== undefined && patch.slug !== undefined,
    "Title and slug required",
  ),
});
export const ReadDraftRequestSchema = z.strictObject({
  id: EditorialReferenceSchema,
  kind: z.enum(["POST", "PAGE"]),
});
export const SaveDraftRequestSchema = z.strictObject({
  ...command,
  baseContentVersion: EditorialVersionSchema,
  patch: DraftPatchSchema,
});
export const PublishRequestSchema = z.strictObject(revisionCommand);
export const UpdatePublicationRequestSchema = PublishRequestSchema;
export const RestoreRevisionRequestSchema = z.strictObject(command);

export const ScheduleRequestSchema = z.strictObject({
  ...revisionCommand,
  scheduledFor: instant,
  displayTimezone: z
    .string()
    .min(1)
    .max(100)
    .refine((zone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: zone });

        return true;
      } catch {
        return false;
      }
    }, "Unknown display timezone")
    .optional(),
});

/** Invoke at the server boundary with one captured clock instant. Schema alone checks syntax. */
export function scheduleRequestSchemaAt(now: Date) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("A valid server instant is required");
  }

  const nowMilliseconds = now.getTime();

  return ScheduleRequestSchema.refine(
    (request) => Date.parse(request.scheduledFor) > nowMilliseconds,
    { path: ["scheduledFor"], message: "Schedule must be in the future" },
  ).transform((request) => ({
    ...request,
    scheduledFor: new Date(request.scheduledFor).toISOString(),
  }));
}

const headerVersion = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,9})$/)
  .transform(Number)
  .pipe(EditorialVersionSchema);
export const PublicationDeleteHeadersSchema = z.strictObject({
  "x-nextpress-content-version": headerVersion,
  "x-nextpress-operation-id": EditorialOperationIdSchema,
});
export const DraftDeleteHeadersSchema = PublicationDeleteHeadersSchema.extend({
  "x-nextpress-draft-version": headerVersion,
});
export const ContentDeleteHeadersSchema = DraftDeleteHeadersSchema;
export const UnpublishRequestSchema = PublicationDeleteHeadersSchema;
export const CancelScheduleRequestSchema = PublicationDeleteHeadersSchema;
export const DiscardDraftRequestSchema = DraftDeleteHeadersSchema;
export const DeleteContentRequestSchema = ContentDeleteHeadersSchema;

export const EditorialErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VERSION_CONFLICT",
  "SLUG_CONFLICT",
  "REFERENCED",
  "UNSUPPORTED_SNAPSHOT",
  "IDEMPOTENCY_CONFLICT",
  "EDITORIAL_CONTRACT_REQUIRED",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);
export const EditorialErrorSchema = ApiErrorSchema.extend({
  code: EditorialErrorCodeSchema.optional(),
  versions: z
    .strictObject({
      contentVersion: EditorialVersionSchema,
      draftVersion: EditorialVersionSchema,
    })
    .optional(),
});
export const VersionConflictSchema = EditorialErrorSchema.extend({
  code: z.literal("VERSION_CONFLICT"),
});

export const EditorialRevisionSchema = z.strictObject({
  id: EditorialReferenceSchema,
  number: EditorialVersionSchema,
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  actor: z
    .strictObject({ id: EditorialReferenceSchema, name: z.string().nullable() })
    .nullable(),
  createdAt: instant,
  reason: z.enum(["CREATE", "SAVE", "RESTORE", "DISCARD", "LEGACY_IMPORT"]),
  coverage: RevisionCoverageSchema,
  provenance: RestoreProvenanceSchema.nullable(),
});
const cursor = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);
export const RevisionPageQuerySchema = z.strictObject({
  cursor: cursor.optional(),
  limit: z
    .union([
      z.number(),
      z
        .string()
        .regex(/^[1-9][0-9]{0,2}$/)
        .transform(Number),
    ])
    .pipe(z.number().int().min(1).max(100))
    .default(25),
});
export const RevisionPageSchema = z.strictObject({
  items: z.array(EditorialRevisionSchema).max(100),
  nextCursor: cursor.nullable(),
});
export const CompareRevisionsQuerySchema = z.strictObject({
  from: EditorialReferenceSchema,
  to: EditorialReferenceSchema,
});
export const CompareRevisionFieldSchema = z.discriminatedUnion("coverage", [
  z.strictObject({
    path: EditorialFieldSchema,
    coverage: z.literal("both"),
    before: z.json(),
    after: z.json(),
  }),
  z.strictObject({
    path: EditorialFieldSchema,
    coverage: z.literal("from-only"),
    before: z.json(),
  }),
  z.strictObject({
    path: EditorialFieldSchema,
    coverage: z.literal("to-only"),
    after: z.json(),
  }),
  z.strictObject({
    path: EditorialFieldSchema,
    coverage: z.literal("neither"),
  }),
]);
export const CompareRevisionsResponseSchema = z.strictObject({
  from: EditorialReferenceSchema,
  to: EditorialReferenceSchema,
  fields: z
    .array(CompareRevisionFieldSchema)
    .max(21)
    .refine(
      (fields) =>
        new Set(fields.map((field) => field.path)).size === fields.length,
      "Duplicate comparison field",
    ),
  unsupported: z.array(z.string().min(1).max(128)).max(100),
});

export const EditorStateSchema = z.strictObject({
  contractVersion: z.literal(1),
  id: EditorialReferenceSchema,
  kind: z.enum(["POST", "PAGE"]),
  contentVersion: EditorialVersionSchema,
  draftVersion: EditorialVersionSchema,
  workingRevisionId: EditorialReferenceSchema,
  working: EditorialSnapshotSchema,
  baseContentVersion: EditorialVersionSchema,
  live: z
    .strictObject({
      revisionId: EditorialReferenceSchema,
      publishedAt: instant.nullable(),
      hash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .nullable(),
  visibility: z.enum(["PRIVATE", "PUBLIC"]),
  schedule: z
    .strictObject({
      revisionId: EditorialReferenceSchema,
      scheduledFor: instant,
      generation: EditorialVersionSchema,
      displayTimezone: z.string().optional(),
    })
    .nullable(),
  capabilities: z.strictObject({
    read: z.boolean(),
    save: z.boolean(),
    publish: z.boolean(),
    unpublish: z.boolean(),
    schedule: z.boolean(),
    restore: z.boolean(),
    discard: z.boolean(),
    delete: z.boolean(),
  }),
  coverage: RevisionCoverageSchema,
});
export const DeleteContentResponseSchema = z.strictObject({
  ok: z.literal(true),
  operationId: EditorialOperationIdSchema,
});
// Mutation responses always carry authoritative accepted versions, with no increment promise.
export const EditorialMutationResponseSchema = EditorStateSchema;
export const IdempotencyRequestIdentitySchema = z.strictObject({
  actorId: EditorialReferenceSchema,
  contentId: EditorialReferenceSchema.nullable(),
  operationId: EditorialOperationIdSchema,
  operation: z.enum([
    "CREATE",
    "SAVE",
    "PUBLISH",
    "UNPUBLISH",
    "SCHEDULE",
    "CANCEL_SCHEDULE",
    "RESTORE",
    "DISCARD",
    "DELETE",
  ]),
  requestHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export type EditorState = z.infer<typeof EditorStateSchema>;
export type ScheduleRequest = z.infer<typeof ScheduleRequestSchema>;
export type EditorialError = z.infer<typeof EditorialErrorSchema>;
