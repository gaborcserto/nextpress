export const POSTS_PER_PAGE = 10;
export const MAX_POSTS_PAGE = 10_000;

export function parsePostsPage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 && page <= MAX_POSTS_PAGE ? page : 1;
}
