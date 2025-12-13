import { prisma } from "@nextpress/db/src/client";

import {
  applyTags,
  validateCreateBody,
  validateUpdateBody,
  runWithSlugConflictHandling,
  PageNotFoundError,
} from "./content.shared";
import {
  createPage,
  updatePage,
  deletePage,
  getPageById,
  getTagsForPage,
} from "@/lib/repos";

/**
 * Create a POST with tags, validate body with PageSchema.
 */
export async function createPostService(rawBody: unknown, authorId: string) {
  const parsed = await validateCreateBody(rawBody);
  const { tagIds, ...pageData } = parsed;

  const created = await runWithSlugConflictHandling(() =>
    createPage({
      ...pageData,
      type: "POST",
      authorId,
    })
  );

  await applyTags(created.id, tagIds);
  return created;
}

/**
 * Update POST with tags, validate body with PageUpdateSchema.
 */
export async function updatePostService(id: string, rawBody: unknown) {
  const parsed = await validateUpdateBody(rawBody);

  const { tagIds = [], ...pageData } = parsed as typeof parsed & {
    tagIds?: string[];
  };

  const updated = await runWithSlugConflictHandling(() =>
    updatePage(id, { ...pageData, type: "POST" })
  );

  await applyTags(updated.id, tagIds);

  return updated;
}

/**
 * Delete a POST by id.
 * Ensures the item exists and is type POST.
 */
export async function deletePostService(id: string): Promise<void> {
  const existing = await getPageById(id, { type: "POST" });
  if (!existing) {
    throw new PageNotFoundError();
  }

  await deletePage(id);
}

/**
 * List posts with pagination (for admin).
 */
export async function listPostsService(page: number, limit: number) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    prisma.page.findMany({
      where: { type: "POST" },
      orderBy: { updatedAt: "desc" },
      skip,
      take: safeLimit,
      select: {
        id: true,
        type: true,
        status: true,
        slug: true,
        title: true,
        excerpt: true,
        updatedAt: true,
      },
    }),
    prisma.page.count({ where: { type: "POST" } }),
  ]);

  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    pages: Math.ceil(total / safeLimit),
  };
}

/**
 * Get post with tags for edit screen.
 * Note: returns the raw Page + tags, mapping to form values is done in the route.
 */
export async function getPostWithTagsService(id: string) {
  const item = await getPageById(id, { type: "POST" });
  if (!item) {
    throw new PageNotFoundError();
  }

  const tags = await getTagsForPage(item.id);

  return { item, tags };
}
