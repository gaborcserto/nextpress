import {
  richContentDocumentIds,
  richContentMediaIds,
} from "@nextpress/shared/content";
import { createHash } from "node:crypto";

import type { Prisma } from "@nextpress/db/generated/prisma/client";
import type { EditorialSnapshot } from "@nextpress/shared/editorial-contracts";

export type ReferenceTargets = {
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
    > &
      Partial<Pick<EditorialSnapshot["fields"], "content" | "excerpt">>;
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
    } else if (block.type === "document") {
      addMedia(
        block.props.documentId,
        "DOCUMENT",
        `${path}.props.documentId`,
        0,
      );
    } else if (block.type === "content-listing" && block.props.taxonomyId) {
      listingIds.add(block.props.taxonomyId);
    }
  };
  fields.pageDocument?.blocks.forEach((block, index) =>
    visit(block, `pageDocument.blocks.${index}`),
  );

  for (const [field, value] of [
    ["content", fields.content],
    ["excerpt", fields.excerpt],
  ] as const) {
    richContentMediaIds(value ?? null).forEach((mediaId, position) =>
      addMedia(mediaId, "CONTENT", `${field}.image.${position}`, position),
    );
    richContentDocumentIds(value ?? null).forEach((mediaId, position) =>
      addMedia(mediaId, "CONTENT", `${field}.document.${position}`, position),
    );
  }

  [...listingIds].forEach((id, position) =>
    addTaxonomy(id, "LISTING", position),
  );

  return { edges, issues };
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
    hash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
    published: page.status === "PUBLISHED" && page.publishedAt !== null,
  };
}
