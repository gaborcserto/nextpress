import {
  contentWriteWhere,
  requireContentWrite,
  type ContentActor,
} from "@/lib/auth/content-access";
import { deletePage, listPages } from "@/lib/repos";
import { createPageWithTags, updatePageWithTags } from "@/lib/repos/pageRepo";
import { validateTagIds } from "@/lib/repos/tagRepo";

import {
  validateCreateBody,
  validateUpdateBody,
  runWithContentConflictHandling,
  PageValidationError,
} from "./content.shared";

/**
 * Create a PAGE with tags, validate body with PageSchema.
 */
export async function createPageService(rawBody: unknown, actor: ContentActor) {
  contentWriteWhere(actor);
  const parsed = validateCreateBody(rawBody);

  if (parsed.type !== "PAGE") {
    throw new PageValidationError([
      { path: "type", message: "Content type does not match endpoint" },
    ]);
  }
  await validateTagIds(parsed.tagIds);
  const { tagIds, ...pageData } = parsed;

  const created = await runWithContentConflictHandling(() =>
    createPageWithTags(
      {
        ...pageData,
        type: "PAGE",
        authorId: actor.id,
      },
      tagIds,
    ),
  );

  return created;
}

/**
 * Update PAGE with tags, validate body with PageUpdateSchema.
 */
export async function updatePageService(
  id: string,
  rawBody: unknown,
  actor: ContentActor,
) {
  await requireContentWrite(id, actor, "PAGE");
  const parsed = validateUpdateBody(rawBody);

  if (parsed.type && parsed.type !== "PAGE") {
    throw new PageValidationError([
      { path: "type", message: "Content type cannot be changed" },
    ]);
  }
  if (parsed.tagIds) await validateTagIds(parsed.tagIds);

  const { tagIds, ...pageData } = parsed;

  const updated = await runWithContentConflictHandling(() =>
    updatePageWithTags(id, pageData, "PAGE", actor, tagIds),
  );

  return updated;
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
export async function listPagesService(
  page: number,
  limit: number,
  actor?: ContentActor | null,
) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const { items, total } = await listPages(skip, safeLimit, { actor });

  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    pages: Math.ceil(total / safeLimit),
  };
}
