import { z } from "zod";

export const POST_LISTING_MODES = ["PAGINATION", "LOAD_MORE"] as const;
export const PostListingModeSchema = z.enum(POST_LISTING_MODES);
export type PostListingMode = z.infer<typeof PostListingModeSchema>;

export const DEFAULT_POST_LISTING_MODE: PostListingMode = "PAGINATION";
export const DEFAULT_POSTS_PER_PAGE = 10;
export const MIN_POSTS_PER_PAGE = 1;
export const MAX_POSTS_PER_PAGE = 50;
export const MAX_POSTS_OFFSET = 100_000;

export const PostsPerPageSchema = z.number().int().min(MIN_POSTS_PER_PAGE).max(MAX_POSTS_PER_PAGE);

export function normalizePostsPerPage(value: unknown): number {
  const parsed = PostsPerPageSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_POSTS_PER_PAGE;
}
