import "server-only";

import {
  DEFAULT_POSTS_PER_PAGE,
  MAX_POSTS_OFFSET,
  MAX_POSTS_PER_PAGE,
} from "@nextpress/shared";
import {
  PublicContentSchema,
  PublicTaxonomyParamsSchema,
  PublicTaxonomyBatchSchema,
  PublicTagBatchSchema,
  PublicNavigationSchema,
  PublicPostBatchSchema,
  type PublicPostSummarySchema,
} from "@nextpress/shared/api-contracts";
import { ContentSlugSchema } from "@nextpress/shared/content";
import { cache } from "react";

import { fetchPublic } from "./public-api.server";

import type { z } from "zod";

export type PublicContent = z.infer<typeof PublicContentSchema>;
export type PublicPublishedPost = PublicContent;
export type PublicPublishedPage = PublicContent;
export type PublicPageNavigation = z.infer<typeof PublicNavigationSchema>;
export type PublicPostSummary = z.infer<typeof PublicPostSummarySchema>;
export type PublicPostBatch = z.infer<typeof PublicPostBatchSchema>;

export function normalizePublicListPagination({
  limit = DEFAULT_POSTS_PER_PAGE,
  offset = 0,
}: { limit?: number; offset?: number } = {}) {
  return {
    limit: Number.isFinite(limit)
      ? Math.min(MAX_POSTS_PER_PAGE, Math.max(1, Math.floor(limit)))
      : DEFAULT_POSTS_PER_PAGE,
    offset: Number.isFinite(offset)
      ? Math.min(MAX_POSTS_OFFSET, Math.max(0, Math.floor(offset)))
      : 0,
  };
}

async function getContent(
  kind: "posts" | "pages",
  slug: string,
  path?: string,
): Promise<PublicContent | null> {
  if (!ContentSlugSchema.safeParse(slug).success || slug !== slug.trim()) {
    return null;
  }

  return fetchPublic(
    `${kind}/${encodeURIComponent(slug)}${path ? `?path=${encodeURIComponent(path)}` : ""}`,
    PublicContentSchema,
    true,
  );
}

export const getPublishedPost = cache((slug: string) =>
  getContent("posts", slug),
);
export const getPublishedPage = cache((slug: string, path?: string) =>
  getContent("pages", slug, path),
);
export const getPublishedHome = cache(() =>
  fetchPublic("home", PublicContentSchema, true),
);

export function getPagePosts(
  page: Pick<PublicPublishedPage, "postsFilter">,
  limit: number,
  offset: number,
) {
  if (page.postsFilter) {
    const { type, slug } = page.postsFilter;

    return getPublishedTaxonomyPosts(type, slug, limit, offset);
  }

  return getPublishedPosts({ limit, offset });
}

export const getPublicPageNavigation = cache(
  async (): Promise<PublicPageNavigation> => {
    return await fetchPublic("navigation", PublicNavigationSchema);
  },
);

export async function getPublishedPosts({
  limit = DEFAULT_POSTS_PER_PAGE,
  offset = 0,
}: { limit?: number; offset?: number } = {}): Promise<PublicPostBatch> {
  const pagination = normalizePublicListPagination({ limit, offset });

  return await fetchPublic(
    `posts?limit=${pagination.limit}&offset=${pagination.offset}`,
    PublicPostBatchSchema,
  );
}

export const getPublishedTaxonomyPosts = cache(
  async (
    type: "CATEGORY" | "TAG",
    slug: string,
    limit: number,
    offset: number,
  ) => {
    const params = PublicTaxonomyParamsSchema.safeParse({ type, slug });

    if (!params.success) {
      return null;
    }

    return fetchPublic(
      `taxonomies/${type}/${encodeURIComponent(params.data.slug)}?limit=${limit}&offset=${offset}`,
      PublicTaxonomyBatchSchema,
      true,
    );
  },
);

export type PublicTagBatch = z.infer<typeof PublicTagBatchSchema>;

export async function getPublishedTags({
  limit = DEFAULT_POSTS_PER_PAGE,
  offset = 0,
}: { limit?: number; offset?: number } = {}): Promise<PublicTagBatch> {
  const pagination = normalizePublicListPagination({ limit, offset });

  return fetchPublic(
    `tags?limit=${pagination.limit}&offset=${pagination.offset}`,
    PublicTagBatchSchema,
  );
}
