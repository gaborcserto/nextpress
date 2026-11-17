import {
  requireContentWrite,
  type ContentActor,
} from "@/lib/auth/content-access";
import {
  deletePage,
  getPageById,
  getTagsForPage,
  listPages,
} from "@/lib/repos";

import {
  createContentService,
  updateContentService,
} from "./content-mutations.server";
import { PageNotFoundError } from "./content.shared";

export function createPostService(rawBody: unknown, actor: ContentActor) {
  return createContentService("POST", rawBody, actor);
}

export function updatePostService(
  id: string,
  rawBody: unknown,
  actor: ContentActor,
) {
  return updateContentService("POST", id, rawBody, actor);
}

/**
 * Delete a POST by id.
 * Ensures the item exists and is type POST.
 */
export async function deletePostService(
  id: string,
  actor: ContentActor,
): Promise<void> {
  await requireContentWrite(id, actor, "POST", true);
  await deletePage(id, "POST", actor);
}

/**
 * List posts with pagination (for admin).
 */
export async function listPostsService(
  page: number,
  limit: number,
  actor?: ContentActor | null,
) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const { items, total } = await listPages(skip, safeLimit, {
    type: "POST",
    actor,
  });

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
export async function getPostWithTagsService(
  id: string,
  actor?: ContentActor | null,
) {
  const item = await getPageById(id, { type: "POST", actor });

  if (!item) {
    throw new PageNotFoundError();
  }

  const tags = await getTagsForPage(item.id);

  return { item, tags };
}
