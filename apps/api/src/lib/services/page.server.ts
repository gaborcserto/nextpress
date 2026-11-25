import { pageLayouts } from "@nextpress/shared/content";

import {
  requireContentWrite,
  type ContentActor,
} from "@/lib/auth/content-access";
import { deletePage } from "@/lib/repos";

import { listAdministrativeContent } from "./content-list.server";
import {
  createContentService,
  updateContentService,
} from "./content-mutations.server";
import { PageConflictError } from "./content.shared";

import type { ContentListFilters } from "@/lib/repos/pageRepo";

export function createPageService(rawBody: unknown, actor: ContentActor) {
  return createContentService("PAGE", rawBody, actor);
}

export function updatePageService(
  id: string,
  rawBody: unknown,
  actor: ContentActor,
) {
  return updateContentService("PAGE", id, rawBody, actor);
}

/**
 * Delete page by id. Throws if not found.
 */
export async function deletePageService(
  id: string,
  actor: ContentActor,
): Promise<void> {
  const page = await requireContentWrite(id, actor, "PAGE", true);

  if (
    page.layout === pageLayouts.home ||
    (page.layout === pageLayouts.posts && page.slug === "posts")
  ) {
    throw new PageConflictError("Protected system pages cannot be deleted.");
  }

  await deletePage(id, "PAGE", actor);
}

/**
 * List pages with pagination (for admin).
 */
export function listPagesService(
  page: number,
  limit: number,
  actor?: ContentActor | null,
  filters?: ContentListFilters,
) {
  return listAdministrativeContent("PAGE", page, limit, actor, filters);
}
