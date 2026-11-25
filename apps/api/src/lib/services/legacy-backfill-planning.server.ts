import "server-only";

import { prisma } from "@nextpress/db/src/client";
import {
  canonicalEditorialJson,
  EditorialSnapshotSchema,
  RevisionCoverageSchema,
  type EditorialSnapshot,
} from "@nextpress/shared/editorial-contracts";
import { readPageDocument } from "@nextpress/shared/page-document";
import { createHash } from "node:crypto";

import {
  legacyPageMapping,
  mapEditorialReferenceEdges,
  type ReferenceTargets,
} from "./editorial-mapping";

import type {
  PageRevision,
  ContentLegacyRevisionImport,
  Prisma,
  PrismaClient,
} from "@nextpress/db/generated/prisma/client";

const ADAPTER_VERSION = 1;

export class BackfillConflictError extends Error {
  constructor(readonly code: string) {
    super("Legacy content backfill conflict");
  }
}

type BackfillClient = PrismaClient | Prisma.TransactionClient;

function digest(value: string) {
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
    const sourceHash = digest(rawSource);
    const revisionId = `legacy-history-${digest(`${pageId}:${source.id}`).slice(0, 48)}`;
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

const include = {
  taxonomies: { include: { taxonomy: true } },
  gallery: true,
} as const;

export async function dryRunLegacyBackfill(db: PrismaClient = prisma) {
  const report = await reconcileLegacyContent(db);

  return {
    ...report,
    required: report.records.filter((row) => row.state === "required").length,
    enrolled: report.reconciled,
    conflicts: report.records.filter((row) => row.state === "conflict").length,
    unsupported: report.records.filter((row) => row.state === "held").length,
  };
}

/** Read-only expected records shared by reconciliation and the isolated persistence test driver. */
export async function planLegacyPage(db: BackfillClient, pageId: string) {
  const page = await db.page.findUniqueOrThrow({
    where: { id: pageId },
    include,
  });

  const [media, taxonomies, pages, users, sources, imports] = await Promise.all(
    [
      db.media.findMany({ select: { id: true } }),
      db.taxonomy.findMany({ select: { id: true } }),
      db.page.findMany({ select: { id: true } }),
      db.user.findMany({ select: { id: true } }),
      db.pageRevision.findMany({ where: { pageId } }),
      db.contentLegacyRevisionImport.findMany({ where: { pageId } }),
    ],
  );
  const targets = {
    mediaIds: new Set(media.map((item) => item.id)),
    taxonomyIds: new Set(taxonomies.map((item) => item.id)),
    pageIds: new Set(pages.map((item) => item.id)),
    userIds: new Set(users.map((item) => item.id)),
  };
  const history = mapLegacyRevisionHistory(pageId, sources, targets, imports);
  const issues = history.flatMap((item) => item.issues);
  let mapped: ReturnType<typeof legacyPageMapping>;

  try {
    mapped = legacyPageMapping(page);
    EditorialSnapshotSchema.parse(mapped.snapshot);
  } catch {
    throw new BackfillConflictError("UNSUPPORTED_CURRENT_SNAPSHOT");
  }

  if (page.status === "PUBLISHED" && !page.publishedAt) {
    issues.push("MISSING_PUBLICATION_TIMESTAMP");
  }

  if (page.authorId && !targets.userIds.has(page.authorId)) {
    issues.push("MISSING_AUTHOR");
  }

  const baselineId = `legacy-baseline-${digest(pageId).slice(0, 48)}`;
  const references = mapEditorialReferenceEdges(
    baselineId,
    mapped.snapshot,
    targets,
  );
  issues.push(...references.issues);
  const number = history.length + 1;
  const revision = {
    id: baselineId,
    pageId,
    number,
    schemaVersion: 1,
    aggregate: mapped.snapshot,
    rawSource: null,
    coverage: { kind: "complete", schemaVersion: 1 },
    aggregateHash: mapped.hash,
    actorId: page.authorId,
    createdAt: page.updatedAt,
    reason: "LEGACY_IMPORT",
    sourceRevisionId: null,
    baseRevisionId: null,
    provenance: null,
  };
  const publicationId = `legacy-publication-${digest(pageId).slice(0, 44)}`;
  const operationHash = digest(`publication:${pageId}`);
  const operationId = `${operationHash.slice(0, 8)}-${operationHash.slice(8, 12)}-4${operationHash.slice(13, 16)}-a${operationHash.slice(17, 20)}-${operationHash.slice(20, 32)}`;
  const publication = {
    id: publicationId,
    pageId,
    revisionId: baselineId,
    generation: 1,
    action: "PUBLISH",
    actorId: page.authorId,
    committedAt: page.updatedAt,
    effectiveAt: page.publishedAt,
    displayedPublishedAt: page.publishedAt,
    operationId,
    enrollmentEpoch: 0,
  };

  return {
    issues: [...new Set(issues)].sort(),
    revisions: [
      ...history.map((item) => ({
        ...item.revision,
        aggregate: null,
        sourceRevisionId: null,
        baseRevisionId: null,
        provenance: null,
      })),
      revision,
    ],
    imports: history.map((item) => item.importRecord),
    media: [
      ...history.flatMap((item) => item.edges.media),
      ...references.edges.media,
    ],
    taxonomies: [
      ...history.flatMap((item) => item.edges.taxonomies),
      ...references.edges.taxonomies,
    ],
    pages: [
      ...history.flatMap((item) => item.edges.pages),
      ...references.edges.pages,
    ],
    state: {
      pageId,
      contentVersion: 0,
      nextRevisionNumber: number + 1,
      visibility: mapped.published ? "PUBLIC" : "PRIVATE",
      liveRevisionId: mapped.published ? baselineId : null,
      initialRevisionId: baselineId,
      lastPublishedAt: mapped.published ? page.publishedAt : null,
      enrollmentState: "SHADOW",
      enrollmentEpoch: 0,
      enrolledAt: null,
      updatedAt: page.updatedAt,
    },
    draft: {
      pageId,
      draftVersion: 0,
      baseContentVersion: 0,
      revisionId: baselineId,
      updatedById: page.authorId,
      updatedAt: page.updatedAt,
    },
    publications: mapped.published ? [publication] : [],
    slugs: mapped.published
      ? [{ normalizedSlug: page.slug, pageId, releaseGeneration: 1 }]
      : [],
    checkpoint: {
      pageId,
      adapterVersion: ADAPTER_VERSION,
      sourceFingerprint: digest(
        canonicalEditorialJson(
          JSON.parse(
            JSON.stringify({
              page: {
                ...page,
                taxonomies: [...page.taxonomies].sort((a, b) =>
                  a.taxonomyId < b.taxonomyId
                    ? -1
                    : a.taxonomyId > b.taxonomyId
                      ? 1
                      : 0,
                ),
                gallery: mapped.snapshot.relationships.gallery,
              },
              sources: history.map((item) => item.revision.aggregateHash),
            }),
          ),
        ),
      ),
      projectionHash: mapped.hash,
      baselineRevisionId: baselineId,
      status: "VERIFIED",
      capturedWorkingVersion: page.workingVersion,
      failureCode: null,
    },
  };
}

// Compare all semantic columns, including nullable provenance. Operational import/check times are excluded.
function comparableRows(rows: readonly object[], keys?: readonly string[]) {
  return rows
    .map((row) => {
      const columns = Object.fromEntries(
        Object.entries(row).filter(([key]) => !keys || keys.includes(key)),
      );

      return canonicalEditorialJson(JSON.parse(JSON.stringify(columns)));
    })
    .sort();
}

export async function inspectLegacyPage(db: BackfillClient, pageId: string) {
  const plan = await planLegacyPage(db, pageId);
  const where = { pageId };
  const revisionWhere = { revision: { pageId } };
  const actual = {
    revisions: await db.contentRevision.findMany({ where }),
    imports: await db.contentLegacyRevisionImport.findMany({ where }),
    media: await db.contentRevisionMedia.findMany({ where: revisionWhere }),
    taxonomies: await db.contentRevisionTaxonomy.findMany({
      where: revisionWhere,
    }),
    pages: await db.contentRevisionPageReference.findMany({
      where: revisionWhere,
    }),
    state: await db.contentEditorialState.findMany({ where }),
    draft: await db.contentDraft.findMany({ where }),
    publications: await db.contentPublication.findMany({ where }),
    slugs: await db.contentSlugReservation.findMany({ where }),
    checkpoint: await db.contentMigrationCheckpoint.findMany({ where }),
  };
  const expected = {
    ...plan,
    state: [plan.state],
    draft: [plan.draft],
    checkpoint: [plan.checkpoint],
  };
  const issues = [...plan.issues];
  let populated = false;

  for (const key of Object.keys(actual) as (keyof typeof actual)[]) {
    const rows = actual[key];
    populated ||= rows.length > 0;
    const wanted = expected[key];
    const columns = wanted[0] ? Object.keys(wanted[0]) : undefined;

    if (
      canonicalEditorialJson(comparableRows(rows, columns)) !==
      canonicalEditorialJson(comparableRows(wanted))
    ) {
      issues.push(`MISMATCH_${key.toUpperCase()}`);
    }
  }

  const extras = await Promise.all([
    db.contentScheduledRelease.count({ where }),
    db.contentEditLease.count({ where }),
    db.contentEditLeaseEvent.count({ where }),
    db.editorialOperation.count({ where }),
  ]);

  if (extras.some(Boolean)) {
    populated = true;
    issues.push("EXISTING_EDITORIAL_ACTIVITY");
  }

  const slugOwner = await db.contentSlugReservation.findUnique({
    where: { normalizedSlug: plan.slugs[0]?.normalizedSlug ?? "" },
  });

  if (plan.slugs.length && slugOwner && slugOwner.pageId !== pageId) {
    issues.push("SLUG_CONFLICT");
  }

  return { plan, populated, issues: [...new Set(issues)].sort() };
}

export async function reconcileLegacyContent(db: PrismaClient = prisma) {
  return db.$transaction(reconcileLegacySnapshot, {
    isolationLevel: "RepeatableRead",
    timeout: 30000,
  });
}

async function reconcileLegacySnapshot(db: Prisma.TransactionClient) {
  const pages = await db.page.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const records = [];

  for (const page of pages) {
    try {
      const result = await inspectLegacyPage(db, page.id);
      let state = "enrolled";

      if (result.issues.length) {
        state = result.populated ? "conflict" : "required";
      }

      if (result.plan.issues.length && !result.populated) {
        state = "held";
      }

      records.push({
        id: page.id,
        state,
        issues: result.issues,
      });
    } catch (error) {
      if (!(error instanceof BackfillConflictError)) {
        throw error;
      }

      records.push({ id: page.id, state: "held", issues: [error.code] });
    }
  }

  return {
    records,
    reconciled: records.filter((row) => row.state === "enrolled").length,
    clean: records.every((row) => row.state === "enrolled"),
  };
}
