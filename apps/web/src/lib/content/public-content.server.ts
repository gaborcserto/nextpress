import "server-only";

import {
  DEFAULT_POSTS_PER_PAGE,
  MAX_POSTS_OFFSET,
  MAX_POSTS_PER_PAGE,
} from "@nextpress/shared";
import {
  PublicContentSchema,
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

async function getContent(
  kind: "posts" | "pages",
  slug: string,
): Promise<PublicContent | null> {
  if (!ContentSlugSchema.safeParse(slug).success || slug !== slug.trim())
    return null;

  return fetchPublic(
    `${kind}/${encodeURIComponent(slug)}`,
    PublicContentSchema,
    true,
  );
}

export const getPublishedPost = cache((slug: string) =>
  getContent("posts", slug),
);
export const getPublishedPage = cache((slug: string) =>
  getContent("pages", slug),
);
export const getPublicPageNavigation = cache(
  async (): Promise<PublicPageNavigation> => {
    return await fetchPublic("navigation", PublicNavigationSchema);
  },
);

export async function getPublishedPosts({
  limit = DEFAULT_POSTS_PER_PAGE,
  offset = 0,
}: { limit?: number; offset?: number } = {}): Promise<PublicPostBatch> {
  const boundedLimit = Number.isFinite(limit)
    ? Math.min(MAX_POSTS_PER_PAGE, Math.max(1, Math.floor(limit)))
    : DEFAULT_POSTS_PER_PAGE;
  const skip = Number.isFinite(offset)
    ? Math.min(MAX_POSTS_OFFSET, Math.max(0, Math.floor(offset)))
    : 0;

  return await fetchPublic(
    `posts?limit=${boundedLimit}&offset=${skip}`,
    PublicPostBatchSchema,
  );
}
