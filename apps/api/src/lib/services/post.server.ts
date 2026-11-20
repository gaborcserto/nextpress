import {
  requireContentWrite,
  type ContentActor,
} from "@/lib/auth/content-access";
import { deletePage, getPageById, getTagsForPage } from "@/lib/repos";

import { listAdministrativeContent } from "./content-list.server";
import {
  createContentService,
  updateContentService,
} from "./content-mutations.server";
import { PageNotFoundError } from "./content.shared";

import type { ContentListFilters } from "@/lib/repos/pageRepo";

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
export function listPostsService(
  page: number,
  limit: number,
  actor?: ContentActor | null,
  filters?: ContentListFilters,
) {
  return listAdministrativeContent("POST", page, limit, actor, filters);
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
