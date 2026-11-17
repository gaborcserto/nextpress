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

type ReferenceTargets = {
  mediaIds: ReadonlySet<string>;
  taxonomyIds: ReadonlySet<string>;
  pageIds: ReadonlySet<string>;
  userIds: ReadonlySet<string>;
};

type ReferenceEdges = {
  media: Prisma.ContentRevisionMediaCreateManyInput[];
  taxonomies: Prisma.ContentRevisionTaxonomyCreateManyInput[];
  pages: Prisma.ContentRevisionPageReferenceCreateManyInput[];
};

/** Produces insert records only. Missing targets hold the plan; they are never silently detached. */
export function mapEditorialReferenceEdges(
  revisionId: string,
  snapshot: {
    fields: Pick<
      EditorialSnapshot["fields"],
      "parentId" | "listingTaxonomyId" | "pageDocument"
    >;
    relationships: EditorialSnapshot["relationships"];
  },
  targets?: ReferenceTargets,
) {
  const edges: ReferenceEdges = { media: [], taxonomies: [], pages: [] };
  const issues: string[] = [];

  const addMedia = (
    mediaId: string,
    usage: string,
    path: string,
    position: number,
  ) => {
    if (targets && !targets.mediaIds.has(mediaId)) {
      issues.push(`MISSING_MEDIA:${path}`);

      return;
    }
    edges.media.push({ revisionId, mediaId, usage, path, position });
  };

  const addTaxonomy = (taxonomyId: string, usage: string, position: number) => {
    if (targets && !targets.taxonomyIds.has(taxonomyId)) {
      issues.push(`MISSING_TAXONOMY:${usage}:${position}`);

      return;
    }
    edges.taxonomies.push({ revisionId, taxonomyId, usage, position });
  };
  const { fields, relationships } = snapshot;

  if (relationships.coverId) {
    addMedia(relationships.coverId, "COVER", "coverId", 0);
  }
  relationships.gallery.forEach((item, position) => {
    addMedia(item.mediaId, "GALLERY", `gallery.${position}`, position);
  });
  relationships.tagIds.forEach((id, position) =>
    addTaxonomy(id, "TAG", position),
  );
  relationships.categoryIds.forEach((id, position) =>
    addTaxonomy(id, "CATEGORY", position),
  );
  const listingIds = new Set<string>();

  if (fields.listingTaxonomyId) {
    listingIds.add(fields.listingTaxonomyId);
  }

  if (fields.parentId) {
    if (!targets || targets.pageIds.has(fields.parentId)) {
      edges.pages.push({
        revisionId,
        targetPageId: fields.parentId,
        usage: "PARENT",
        path: "parentId",
      });
    } else {
      issues.push("MISSING_PAGE:parentId");
    }
  }

  const visit = (
    block: NonNullable<
      EditorialSnapshot["fields"]["pageDocument"]
    >["blocks"][number],
    path: string,
  ) => {
    if (block.type === "columns") {
      block.regions.forEach((region, regionIndex) =>
        region.forEach((child, childIndex) =>
          visit(child, `${path}.regions.${regionIndex}.${childIndex}`),
        ),
      );
    } else if (
      (block.type === "image" || block.type === "hero") &&
      block.props.mediaId
    ) {
      addMedia(block.props.mediaId, "DOCUMENT", `${path}.props.mediaId`, 0);
    } else if (block.type === "content-listing" && block.props.taxonomyId) {
      listingIds.add(block.props.taxonomyId);
    }
  };
  fields.pageDocument?.blocks.forEach((block, index) =>
    visit(block, `pageDocument.blocks.${index}`),
  );
  [...listingIds].forEach((id, position) =>
    addTaxonomy(id, "LISTING", position),
  );

  return { edges, issues };
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

/** Current Page state is a baseline snapshot, never represented as historical editorial activity. */
export function legacyPageMapping(page: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  pageDocument: string | null;
  layout: string;
  inHeaderMenu: boolean;
  inFooterMenu: boolean;
  parentId: string | null;
  listingKind: string | null;
  listingTaxonomyId: string | null;
  eventStart: Date | null;
  eventEnd: Date | null;
  eventLocation: string | null;
  registrationUrl: string | null;
  redirectTo: string | null;
  coverId: string | null;
  status: string;
  publishedAt: Date | null;
  authorId: string | null;
  workingVersion: number;
  updatedAt: Date;
  createdAt: Date;
  taxonomies: { taxonomyId: string; taxonomy: { type: string } }[];
  gallery: { mediaId: string; sort: number }[];
}) {
  const snapshot = {
    schemaVersion: 1 as const,
    fields: {
      title: page.title,
      slug: page.slug,
      excerpt: page.excerpt,
      content: page.content,
      pageDocument: page.pageDocument ? JSON.parse(page.pageDocument) : null,
      layout: page.layout,
      inHeaderMenu: page.inHeaderMenu,
      inFooterMenu: page.inFooterMenu,
      parentId: page.parentId,
      listingKind: page.listingKind,
      listingTaxonomyId: page.listingTaxonomyId,
      eventStart: page.eventStart?.toISOString() ?? null,
      eventEnd: page.eventEnd?.toISOString() ?? null,
      eventLocation: page.eventLocation,
      registrationUrl: page.registrationUrl,
      redirectTo: page.redirectTo,
    },
    relationships: {
      coverId: page.coverId,
      tagIds: page.taxonomies
        .filter((item) => item.taxonomy.type === "TAG")
        .map((item) => item.taxonomyId)
        .sort(),
      categoryIds: page.taxonomies
        .filter((item) => item.taxonomy.type === "CATEGORY")
        .map((item) => item.taxonomyId)
        .sort(),
      gallery: page.gallery
        .map(({ mediaId, sort }) => ({ mediaId, sort }))
        .sort((a, b) => a.sort - b.sort || a.mediaId.localeCompare(b.mediaId)),
    },
    extensions: { schemaVersion: 1 as const, values: {} },
  };

  return {
    snapshot,
    hash: digest(JSON.stringify(snapshot)),
    published: page.status === "PUBLISHED" && page.publishedAt !== null,
  };
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

export async function backfillLegacyContent(options: {
  db?: PrismaClient;
  ownership?: import("./legacy-backfill-fence.server").BackfillOwnership;
  pageIds?: readonly string[];
}) {
  if (!options.ownership || !options.pageIds?.length) {
    throw new BackfillConflictError("BACKFILL_FENCE_REQUIRED");
  }
  const { persistFencedLegacyPage } =
    await import("./legacy-backfill-persistence.server");
  const results = [];

  for (const pageId of options.pageIds) {
    const state = await persistFencedLegacyPage(
      options.db ?? prisma,
      pageId,
      options.ownership,
    );
    results.push({ pageId, state });
  }

  return results;
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
