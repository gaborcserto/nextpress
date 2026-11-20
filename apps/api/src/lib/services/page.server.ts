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
  await requireContentWrite(id, actor, "PAGE", true);
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
