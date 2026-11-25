import {
  isPagePath,
  maxPageDepth,
  pageLayouts,
} from "@nextpress/shared/content";
import { z } from "zod";

export const PagePathRowsSchema = z.array(
  z.object({
    id: z.string(),
    slug: z.string(),
    layout: z.string(),
    parentId: z.string().nullable(),
  }),
);

export type PagePathRow = z.infer<typeof PagePathRowsSchema>[number];

export function resolvePagePath(id: string, rows: PagePathRow[]) {
  const pageById = new Map(rows.map((page) => [page.id, page]));
  const page = pageById.get(id);

  if (!page) {
    return undefined;
  }

  if (page.layout === pageLayouts.home) {
    return "/";
  }

  if (page.layout === pageLayouts.posts && page.slug === "posts") {
    return "/posts";
  }

  const segments: string[] = [];
  const visited = new Set<string>();
  let current: PagePathRow | undefined = page;

  while (current && segments.length < maxPageDepth) {
    if (visited.has(current.id)) {
      break;
    }

    visited.add(current.id);
    segments.unshift(current.slug);
    current = current.parentId ? pageById.get(current.parentId) : undefined;
  }

  if (current || segments.length > maxPageDepth) {
    return `/pages/${page.slug}`;
  }

  return segments.length > 1 && !isPagePath(segments)
    ? `/pages/${page.slug}`
    : `/${segments.join("/")}`;
}
