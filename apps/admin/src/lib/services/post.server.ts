import {
  applyTags,
  validateCreateBody,
  validateUpdateBody,
  runWithSlugConflictHandling,
  PageNotFoundError,
  PageValidationError,
} from "./content.shared";
import { contentWriteWhere, requireContentWrite, type ContentActor } from "@/lib/auth/content-access";
import {
  createPage,
  updatePage,
  deletePage,
  getPageById,
  getTagsForPage,
  listPages,
} from "@/lib/repos";
import { validateTagIds } from "@/lib/repos/tagRepo";

/**
 * Create a POST with tags, validate body with PageSchema.
 */
export async function createPostService(rawBody: unknown, actor: ContentActor) {
  contentWriteWhere(actor);
  const parsed = validateCreateBody(rawBody);
  if (parsed.type !== "POST") {
    throw new PageValidationError([{ path: "type", message: "Content type does not match endpoint" }]);
  }
  await validateTagIds(parsed.tagIds);
  const { tagIds, ...pageData } = parsed;

  const created = await runWithSlugConflictHandling(() =>
    createPage({
      ...pageData,
      type: "POST",
      authorId: actor.id,
    })
  );

  await applyTags(created.id, tagIds);
  return created;
}

/**
 * Update POST with tags, validate body with PageUpdateSchema.
 */
export async function updatePostService(id: string, rawBody: unknown, actor: ContentActor) {
  await requireContentWrite(id, actor, "POST");
  const parsed = validateUpdateBody(rawBody);
  if (parsed.type && parsed.type !== "POST") {
    throw new PageValidationError([{ path: "type", message: "Content type cannot be changed" }]);
  }
  if (parsed.tagIds) await validateTagIds(parsed.tagIds);

  const { tagIds, ...pageData } = parsed;

  const updated = await runWithSlugConflictHandling(() =>
    updatePage(id, pageData, "POST", actor)
  );

  if (tagIds !== undefined) await applyTags(updated.id, tagIds);

  return updated;
}

/**
 * Delete a POST by id.
 * Ensures the item exists and is type POST.
 */
export async function deletePostService(id: string, actor: ContentActor): Promise<void> {
  await requireContentWrite(id, actor, "POST", true);
  await deletePage(id, "POST", actor);
}

/**
 * List posts with pagination (for admin).
 */
export async function listPostsService(page: number, limit: number, actor?: ContentActor | null) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const { items, total } = await listPages(skip, safeLimit, { type: "POST", actor });

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
export async function getPostWithTagsService(id: string, actor?: ContentActor | null) {
  const item = await getPageById(id, { type: "POST", actor });
  if (!item) {
    throw new PageNotFoundError();
  }

  const tags = await getTagsForPage(item.id);

  return { item, tags };
}
