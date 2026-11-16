import {
  CreateDraftRequestSchema,
  SaveDraftRequestSchema,
  PublishRequestSchema,
  RestoreRevisionRequestSchema,
  ScheduleRequestSchema,
  EditorStateSchema,
  EditorialErrorSchema,
  RevisionPageQuerySchema,
  RevisionPageSchema,
  CompareRevisionsQuerySchema,
  CompareRevisionsResponseSchema,
  DeleteContentResponseSchema,
  PublicationDeleteHeadersSchema,
  DraftDeleteHeadersSchema,
  EditorialSnapshotSchema,
  DraftPatchSchema,
} from "@nextpress/shared/editorial-contracts";
import { z } from "zod";

/** Design catalog only. Never merged into active OpenAPI or route coverage. */
export const proposedEditorialSchemas = {
  EditorialSnapshot: EditorialSnapshotSchema,
  DraftPatch: DraftPatchSchema,
  CreateDraft: CreateDraftRequestSchema,
  SaveDraft: SaveDraftRequestSchema,
  Publish: PublishRequestSchema,
  Schedule: ScheduleRequestSchema,
  Restore: RestoreRevisionRequestSchema,
  EditorState: EditorStateSchema,
  EditorialError: EditorialErrorSchema,
  RevisionPageQuery: RevisionPageQuerySchema,
  RevisionPage: RevisionPageSchema,
  CompareQuery: CompareRevisionsQuerySchema,
  CompareResponse: CompareRevisionsResponseSchema,
  DeleteResponse: DeleteContentResponseSchema,
  PublicationDeleteHeaders: PublicationDeleteHeadersSchema,
  DraftDeleteHeaders: DraftDeleteHeadersSchema,
};

export const proposedEditorialOperations = [
  {
    method: "POST",
    suffix: "/drafts",
    request: "CreateDraft",
    response: "EditorState",
    status: 201,
  },
  {
    method: "GET",
    suffix: "/{id}/draft",
    response: "EditorState",
    status: 200,
  },
  {
    method: "PUT",
    suffix: "/{id}/draft",
    request: "SaveDraft",
    response: "EditorState",
    status: 200,
  },
  {
    method: "POST",
    suffix: "/{id}/publication",
    request: "Publish",
    response: "EditorState",
    status: 200,
  },
  {
    method: "DELETE",
    suffix: "/{id}/publication",
    headers: "PublicationDeleteHeaders",
    response: "EditorState",
    status: 200,
  },
  {
    method: "PUT",
    suffix: "/{id}/schedule",
    request: "Schedule",
    response: "EditorState",
    status: 200,
  },
  {
    method: "DELETE",
    suffix: "/{id}/schedule",
    headers: "PublicationDeleteHeaders",
    response: "EditorState",
    status: 200,
  },
  {
    method: "GET",
    suffix: "/{id}/revisions",
    query: "RevisionPageQuery",
    response: "RevisionPage",
    status: 200,
  },
  {
    method: "GET",
    suffix: "/{id}/revisions/compare",
    query: "CompareQuery",
    response: "CompareResponse",
    status: 200,
  },
  {
    method: "POST",
    suffix: "/{id}/revisions/{revisionId}/restore",
    request: "Restore",
    response: "EditorState",
    status: 200,
  },
  {
    method: "DELETE",
    suffix: "/{id}/draft",
    headers: "DraftDeleteHeaders",
    response: "EditorState",
    status: 200,
  },
  {
    method: "DELETE",
    suffix: "/{id}",
    headers: "DraftDeleteHeaders",
    response: "DeleteResponse",
    status: 200,
  },
] as const;

export function proposedEditorialCatalog() {
  return {
    status: "PROPOSED_NOT_IMPLEMENTED",
    contractVersion: 1,
    roots: ["/api/post", "/api/pages"],
    operations: proposedEditorialOperations,
    schemas: Object.fromEntries(
      Object.entries(proposedEditorialSchemas).map(([name, value]) => [
        name,
        z.toJSONSchema(value, { io: "input", target: "openapi-3.0" }),
      ]),
    ),
    rules: {
      deletes:
        "Bodyless. Validate only named lowercase headers extracted from Headers; reject duplicate/combined values. Forwarder allowlist is B07 work. Existing handlers unchanged.",
      scheduling:
        "Offset required; validate future against one server instant with scheduleRequestSchemaAt. Persist normalized UTC. Display timezone does not reinterpret the instant. Reject nonexistent wall times and require explicit offset choice for overlaps in future UI.",
      revisions:
        "Order number DESC then id DESC; opaque cursor bound to content and last number/id. Legacy pages revisions route remains unchanged until negotiated integration.",
      retries:
        "Same actor, operation kind, content identity, UUID and canonical request hash. Changed request conflicts. Authorize replay; do not expose internal receipts. Retention not approved.",
      authorization:
        "Session-only, no-store. Server ownership/role/reference checks remain mandatory; capabilities and headers confer no authorization.",
    },
  };
}
