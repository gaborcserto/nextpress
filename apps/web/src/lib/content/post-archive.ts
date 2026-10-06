import {
  DEFAULT_POSTS_PER_PAGE,
  MAX_POSTS_OFFSET,
  normalizePostsPerPage,
} from "@nextpress/shared";

export const POSTS_PER_PAGE = DEFAULT_POSTS_PER_PAGE;

export function getMaxPostsPage(postsPerPage = POSTS_PER_PAGE): number {
  return Math.floor(MAX_POSTS_OFFSET / normalizePostsPerPage(postsPerPage)) + 1;
}

export function parsePostsPage(value: string | string[] | undefined, postsPerPage = POSTS_PER_PAGE): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 && page <= getMaxPostsPage(postsPerPage) ? page : 1;
}
