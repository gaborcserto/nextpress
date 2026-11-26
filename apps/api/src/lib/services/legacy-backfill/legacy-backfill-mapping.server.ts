import "server-only";

import {
  canonicalEditorialJson,
  RevisionCoverageSchema,
  type EditorialSnapshot,
} from "@nextpress/shared/editorial-contracts";
import { readPageDocument } from "@nextpress/shared/page-document";
import { createHash } from "node:crypto";

import {
  mapEditorialReferenceEdges,
  type ReferenceTargets,
} from "../editorial-mapping";

import type {
  ContentLegacyRevisionImport,
  PageRevision,
  Prisma,
} from "@nextpress/db/generated/prisma/client";

export const ADAPTER_VERSION = 1;

export class BackfillConflictError extends Error {
  constructor(readonly code: string) {
    super("Legacy content backfill conflict");
  }
}

export function digestLegacySource(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Partial history retains source bytes and metadata; current Page relationships are never inherited. */
export function mapLegacyRevisionHistory(
  pageId: string,
  revisions: readonly PageRevision[],
  targets: ReferenceTargets,
  existing: readonly ContentLegacyRevisionImport[] = [],
) {
  const ordered = [...revisions].sort(
    (a, b) =>
      a.workingVersion - b.workingVersion ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const seen = new Set<string>();

  return ordered.map((source, index) => {
    if (source.pageId !== pageId || seen.has(source.id)) {
      throw new BackfillConflictError("INVALID_HISTORY_IDENTITY");
    }

    seen.add(source.id);
    const rawSource = canonicalEditorialJson({
      ...source,
      createdAt: source.createdAt.toISOString(),
      publishedAt: source.publishedAt?.toISOString() ?? null,
    });
    const sourceHash = digestLegacySource(rawSource);
    const revisionId = `legacy-history-${digestLegacySource(`${pageId}:${source.id}`).slice(0, 48)}`;
    const issues: string[] = [];
    let document: EditorialSnapshot["fields"]["pageDocument"] = null;

    if (source.pageDocument !== null) {
      try {
        const parsed = readPageDocument(source.pageDocument);

        if (parsed.supported) {
          document = parsed.document;
        } else {
          issues.push("UNSUPPORTED_PAGE_DOCUMENT");
        }
      } catch {
        issues.push("UNSUPPORTED_PAGE_DOCUMENT");
      }
    }

    const coverage = RevisionCoverageSchema.parse({
      kind: "legacy-partial",
      legacyRevisionId: source.id,
      covered: [
        "title",
        "slug",
        "excerpt",
        "content",
        "layout",
        ...(issues.length ? [] : ["pageDocument"]),
      ],
      unsupported: issues,
    });
    // Only the stored document has historical references. Absent historical fields stay absent in rawSource.
    const references = mapEditorialReferenceEdges(
      revisionId,
      {
        fields: {
          pageDocument: document,
          parentId: null,
          listingTaxonomyId: null,
          content: source.content,
          excerpt: source.excerpt,
        },
        relationships: {
          coverId: null,
          gallery: [],
          tagIds: [],
          categoryIds: [],
        },
      },
      targets,
    );
    issues.push(...references.issues);

    if (source.authorId && !targets.userIds.has(source.authorId)) {
      issues.push("MISSING_AUTHOR");
    }

    const imported = existing.find(
      (item) => item.legacyRevisionId === source.id,
    );

    if (
      imported &&
      (imported.pageId !== pageId ||
        imported.sourceHash !== sourceHash ||
        imported.revisionId !== revisionId ||
        imported.adapterVersion !== ADAPTER_VERSION)
    ) {
      issues.push("HISTORY_IMPORT_CONFLICT");
    }

    const revision = {
      id: revisionId,
      pageId,
      number: index + 1,
      schemaVersion: 1,
      rawSource,
      coverage,
      aggregateHash: sourceHash,
      actorId:
        source.authorId && targets.userIds.has(source.authorId)
          ? source.authorId
          : null,
      createdAt: source.createdAt,
      reason: "LEGACY_IMPORT",
    } satisfies Prisma.ContentRevisionCreateManyInput;

    return {
      revision,
      importRecord: {
        legacyRevisionId: source.id,
        pageId,
        revisionId,
        sourceHash,
        adapterVersion: ADAPTER_VERSION,
      },
      edges: references.edges,
      issues,
      state: issues.length
        ? ("held" as const)
        : imported
          ? ("existing" as const)
          : ("pending" as const),
    };
  });
}
