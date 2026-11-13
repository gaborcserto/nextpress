import "server-only";

import { prisma, type Prisma } from "@nextpress/db";
import {
  DEFAULT_POSTS_PER_PAGE,
  MAX_POSTS_OFFSET,
  MAX_POSTS_PER_PAGE,
} from "@nextpress/shared";
import { PublicTaxonomyParamsSchema } from "@nextpress/shared/api-contracts";
import { ContentSlugSchema, richContentText } from "@nextpress/shared/content";
import { readPageDocument } from "@nextpress/shared/page-document";

import { parsePublicRichContent } from "./rich-content";

import type {
  PublicContentSchema,
  PublicNavigationSchema,
  PublicPostSummarySchema,
  PublicPostBatchSchema,
  PublicTaxonomyBatchSchema,
  PublicTagBatchSchema,
} from "@nextpress/shared/api-contracts";
import type { z } from "zod";

const publicContentSelect = {
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  pageDocument: true,
  publishedAt: true,
  author: { select: { name: true } },
  taxonomies: {
    select: { taxonomy: { select: { type: true, slug: true, name: true } } },
  },
  cover: {
    select: { url: true, alt: true, mime: true, width: true, height: true },
  },
} satisfies Prisma.PageSelect;

const publicPostSummarySelect = {
  slug: true,
  title: true,
  excerpt: true,
  publishedAt: true,
  author: { select: { name: true } },
  taxonomies: {
    select: { taxonomy: { select: { type: true, slug: true, name: true } } },
  },
  cover: publicContentSelect.cover,
} satisfies Prisma.PageSelect;

type PublicContentRow = Prisma.PageGetPayload<{
  select: typeof publicContentSelect;
}>;
type PublicPostSummaryRow = Prisma.PageGetPayload<{
  select: typeof publicPostSummarySelect;
}>;

const publicPageNavigationSelect = {
  slug: true,
  title: true,
  inHeaderMenu: true,
  inFooterMenu: true,
} satisfies Prisma.PageSelect;

type PublicPageNavigationRow = Prisma.PageGetPayload<{
  select: typeof publicPageNavigationSelect;
}>;

type PublicContent = z.infer<typeof PublicContentSchema>;
type PublicPublishedPost = PublicContent;
type PublicPublishedPage = PublicContent;
type PublicPageNavigation = z.infer<typeof PublicNavigationSchema>;
type PublicPostSummary = z.infer<typeof PublicPostSummarySchema>;
type PublicPostBatch = z.infer<typeof PublicPostBatchSchema>;

function projectPublicCover(
  cover: PublicContentRow["cover"],
): PublicContent["cover"] {
  return cover &&
    cover.mime.startsWith("image/") &&
    /^\/(?!\/)/.test(cover.url) &&
    // Rejecting control characters is intentional at this untrusted URL boundary.
    // eslint-disable-next-line no-control-regex
    !/[\\\u0000-\u0020]/.test(cover.url)
    ? {
        url: cover.url,
        alt: cover.alt ?? "",
        width: cover.width,
        height: cover.height,
      }
    : null;
}

function projectPublicContent(row: PublicContentRow): PublicContent {
  if (!row.publishedAt) throw new Error("Missing publication time");
  const document = row.pageDocument ? readPageDocument(row.pageDocument) : null;
  return {
    ...(row.pageDocument
      ? { pageDocument: document?.supported ? document.document : null }
      : {}),
    slug: row.slug,
    title: row.title,
    summary: richContentText(parsePublicRichContent(row.excerpt)),
    content: parsePublicRichContent(row.content),
    publishedAt: row.publishedAt.toISOString(),
    author: row.author?.name ? { name: row.author.name } : null,
    taxonomies: row.taxonomies.map(({ taxonomy }) => ({
      type: taxonomy.type,
      slug: taxonomy.slug,
      name: taxonomy.name,
    })),
    cover: projectPublicCover(row.cover),
  };
}

function projectPublicPostSummary(
  row: PublicPostSummaryRow,
): PublicPostSummary {
  if (!row.publishedAt) throw new Error("Missing publication time");
  return {
    cover: projectPublicCover(row.cover),
    slug: row.slug,
    title: row.title,
    summary: richContentText(parsePublicRichContent(row.excerpt)),
    publishedAt: row.publishedAt.toISOString(),
    author: row.author?.name ? { name: row.author.name } : null,
    taxonomies: row.taxonomies.map(({ taxonomy }) => ({
      type: taxonomy.type,
      slug: taxonomy.slug,
      name: taxonomy.name,
    })),
  };
}

/** A public post must have an explicit publication time at or before this request. */
export async function getPublishedPost(
  slug: string,
): Promise<PublicPublishedPost | null> {
  if (!ContentSlugSchema.safeParse(slug).success || slug !== slug.trim())
    return null;
  const row = await prisma.page.findFirst({
    where: {
      slug,
      type: "POST",
      status: "PUBLISHED",
      publishedAt: { not: null, lte: new Date() },
    },
    select: publicContentSelect,
  });
  if (!row?.publishedAt) return null;
  return {
    ...projectPublicContent(row),
    publishedAt: row.publishedAt.toISOString(),
  };
}

/** Static pages use the same strict publication boundary as public posts. */
export async function getPublishedPage(
  slug: string,
): Promise<PublicPublishedPage | null> {
  if (!ContentSlugSchema.safeParse(slug).success || slug !== slug.trim())
    return null;
  const row = await prisma.page.findFirst({
    where: {
      slug,
      type: "PAGE",
      status: "PUBLISHED",
      publishedAt: { not: null, lte: new Date() },
    },
    select: publicContentSelect,
  });
  if (!row?.publishedAt) return null;
  return {
    ...projectPublicContent(row),
    publishedAt: row.publishedAt.toISOString(),
  };
}

/** Navigation is selected only from pages currently available to the public. */
export async function getPublicPageNavigation(): Promise<PublicPageNavigation> {
  const rows = await prisma.page.findMany({
    where: {
      type: "PAGE",
      status: "PUBLISHED",
      publishedAt: { not: null, lte: new Date() },
      OR: [{ inHeaderMenu: true }, { inFooterMenu: true }],
    },
    // The model has no menu position; title and slug give stable alphabetical ordering.
    orderBy: [{ title: "asc" }, { slug: "asc" }],
    select: publicPageNavigationSelect,
  });
  const project = ({ slug, title }: PublicPageNavigationRow) => ({
    slug,
    title,
  });
  return {
    header: rows.filter(({ inHeaderMenu }) => inHeaderMenu).map(project),
    footer: rows.filter(({ inFooterMenu }) => inFooterMenu).map(project),
  };
}

/** Published summaries only; limit + 1 indicates whether another bounded batch exists. */
export async function getPublishedPosts({
  limit = DEFAULT_POSTS_PER_PAGE,
  offset = 0,
  taxonomy,
}: {
  limit?: number;
  offset?: number;
  taxonomy?: z.infer<typeof PublicTaxonomyParamsSchema>;
} = {}): Promise<PublicPostBatch> {
  const boundedLimit = Number.isFinite(limit)
    ? Math.min(MAX_POSTS_PER_PAGE, Math.max(1, Math.floor(limit)))
    : DEFAULT_POSTS_PER_PAGE;
  const skip = Number.isFinite(offset)
    ? Math.min(MAX_POSTS_OFFSET, Math.max(0, Math.floor(offset)))
    : 0;
  const rows = await prisma.page.findMany({
    where: {
      ...(taxonomy
        ? {
            taxonomies: {
              some: { taxonomy: { type: taxonomy.type, slug: taxonomy.slug } },
            },
          }
        : {}),
      type: "POST",
      status: "PUBLISHED",
      publishedAt: { not: null, lte: new Date() },
    },
    orderBy: [{ publishedAt: "desc" }, { slug: "asc" }],
    skip,
    take: boundedLimit + 1,
    select: publicPostSummarySelect,
  });
  const hasMore = rows.length > boundedLimit;
  return {
    posts: rows.slice(0, boundedLimit).map(projectPublicPostSummary),
    hasMore,
  };
}

export async function getPublishedTaxonomyPosts(
  params: z.infer<typeof PublicTaxonomyParamsSchema>,
  pagination: { limit: number; offset: number },
): Promise<z.infer<typeof PublicTaxonomyBatchSchema> | null> {
  const parsed = PublicTaxonomyParamsSchema.safeParse(params);

  if (!parsed.success) {
    return null;
  }

  const taxonomy = await prisma.taxonomy.findFirst({
    where: { type: parsed.data.type, slug: parsed.data.slug },
    select: { type: true, slug: true, name: true },
  });

  if (!taxonomy) {
    return null;
  }

  const batch = await getPublishedPosts({
    ...pagination,
    taxonomy: parsed.data,
  });

  return {
    taxonomy: { type: taxonomy.type, slug: taxonomy.slug, name: taxonomy.name },
    ...batch,
  };
}

export async function getPublishedTags({
  limit = DEFAULT_POSTS_PER_PAGE,
  offset = 0,
}: { limit?: number; offset?: number } = {}): Promise<
  z.infer<typeof PublicTagBatchSchema>
> {
  const boundedLimit = Number.isFinite(limit)
    ? Math.min(MAX_POSTS_PER_PAGE, Math.max(1, Math.floor(limit)))
    : DEFAULT_POSTS_PER_PAGE;
  const skip = Number.isFinite(offset)
    ? Math.min(MAX_POSTS_OFFSET, Math.max(0, Math.floor(offset)))
    : 0;
  const rows = await prisma.taxonomy.findMany({
    where: {
      type: "TAG",
      pages: {
        some: {
          page: {
            type: "POST",
            status: "PUBLISHED",
            publishedAt: { not: null, lte: new Date() },
          },
        },
      },
    },
    orderBy: { slug: "asc" },
    take: boundedLimit + 1,
    skip,
    select: { type: true, slug: true, name: true },
  });

  return {
    tags: rows
      .slice(0, boundedLimit)
      .map(({ slug, name }) => ({ type: "TAG", slug, name })),
    hasMore: rows.length > boundedLimit,
  };
}
