import "server-only";

import {
  canonicalEditorialJson,
  EditorialSnapshotSchema,
} from "@nextpress/shared/editorial-contracts";
import { readPageDocument } from "@nextpress/shared/page-document";
import { createHash } from "node:crypto";

import {
  contentWriteWhere,
  ContentForbiddenError,
} from "@/lib/auth/content-access";
import {
  WorkingAggregateEditSchema,
  WorkingAggregateSchema,
  type WorkingAggregate,
} from "@/lib/validation/working-aggregate";

import { legacyPageMapping } from "./legacy-content-backfill.server";

import type {
  PageRevision,
  Prisma,
} from "@nextpress/db/generated/prisma/client";

import type { ContentActor } from "@/lib/auth/content-access";

export type LegacyAggregateSource = Prisma.PageGetPayload<{
  include: { taxonomies: { include: { taxonomy: true } }; gallery: true };
}>;

export class WorkingAggregateConflictError extends Error {
  readonly code = "VERSION_CONFLICT";
}

/** Legacy history covers six fields only; retain the current private values for all others. */
export function restoreLegacyWorkingAggregate(
  current: WorkingAggregate,
  revision: PageRevision,
): WorkingAggregate {
  if (revision.pageId !== current.pageId) {
    throw new WorkingAggregateConflictError("IDENTITY_CONFLICT");
  }
  let pageDocument = null;

  if (revision.pageDocument !== null) {
    try {
      const parsed = readPageDocument(revision.pageDocument);

      if (!parsed.supported) {
        throw new Error("Unsupported document");
      }
      pageDocument = parsed.document;
    } catch {
      throw new WorkingAggregateConflictError("UNSUPPORTED_LEGACY_REVISION");
    }
  }

  return WorkingAggregateSchema.parse({
    ...current,
    snapshot: {
      ...current.snapshot,
      fields: {
        ...current.snapshot.fields,
        title: revision.title,
        slug: revision.slug,
        excerpt: revision.excerpt,
        content: revision.content,
        layout: revision.layout,
        pageDocument,
      },
    },
    rawPageDocument: revision.pageDocument,
    publicationIntent: { action: "PRESERVE" },
  });
}

/** Pure capture from one consistent database snapshot; statistics and auth data are excluded. */
export function captureWorkingAggregate(
  source: LegacyAggregateSource,
): WorkingAggregate {
  // An empty stored string is unsupported, not equivalent to SQL NULL.
  if (source.pageDocument !== null && !source.pageDocument.trim()) {
    throw new Error("UNSUPPORTED_PAGE_DOCUMENT");
  }
  const snapshot = EditorialSnapshotSchema.parse(
    legacyPageMapping(source).snapshot,
  );
  const state = {
    contractVersion: 1 as const,
    pageId: source.id,
    kind: source.type,
    ownerId: source.authorId,
    baseVersion: source.workingVersion,
    snapshot,
    rawPageDocument: source.pageDocument,
    publicState: {
      status: source.status,
      publishedAt: source.publishedAt?.toISOString() ?? null,
    },
    publicationIntent: { action: "PRESERVE" as const },
  };
  const baseFingerprint = createHash("sha256")
    .update(canonicalEditorialJson(state))
    .digest("hex");

  return WorkingAggregateSchema.parse({ ...state, baseFingerprint });
}

/** Preparation only: no version increment or claim of accepted persistence. */
export function prepareWorkingAggregateEdit(
  current: WorkingAggregate,
  input: unknown,
  actor: ContentActor,
): WorkingAggregate {
  const scope = contentWriteWhere(actor);

  if (scope.authorId && current.ownerId !== scope.authorId) {
    throw new ContentForbiddenError();
  }
  const edit = WorkingAggregateEditSchema.parse(input);

  if (
    current.baseVersion !== edit.expectedVersion ||
    current.baseFingerprint !== edit.expectedFingerprint
  ) {
    throw new WorkingAggregateConflictError();
  }
  const { tagIds, ...fields } = edit.patch;

  return WorkingAggregateSchema.parse({
    ...current,
    snapshot: {
      ...current.snapshot,
      fields: { ...current.snapshot.fields, ...fields },
      relationships: {
        ...current.snapshot.relationships,
        ...(tagIds === undefined ? {} : { tagIds }),
      },
    },
    publicationIntent: edit.publicationIntent ?? current.publicationIntent,
  });
}

/** Exact legacy projection for comparison/rollback rehearsal, never a Prisma write payload. */
export function workingAggregateLegacyProjection(input: unknown) {
  const aggregate = WorkingAggregateSchema.parse(input);
  const { pageDocument: _document, ...fields } = aggregate.snapshot.fields;

  return {
    id: aggregate.pageId,
    type: aggregate.kind,
    authorId: aggregate.ownerId,
    workingVersion: aggregate.baseVersion,
    ...fields,
    pageDocument: aggregate.rawPageDocument,
    ...aggregate.snapshot.relationships,
    ...aggregate.publicState,
  };
}

/** Detects unversioned taxonomy/gallery changes as well as scalar/revision changes. */
export function assertWorkingAggregateBase(
  aggregate: WorkingAggregate,
  source: LegacyAggregateSource,
) {
  const fresh = captureWorkingAggregate(source);

  if (
    aggregate.pageId !== fresh.pageId ||
    aggregate.baseVersion !== fresh.baseVersion ||
    aggregate.baseFingerprint !== fresh.baseFingerprint
  ) {
    throw new WorkingAggregateConflictError();
  }
}
