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
  listPages,
  getPageById,
} from "@/lib/repos";

/**
 * Create a PAGE with tags, validate body with PageSchema.
 */
export async function createPageService(rawBody: unknown, authorId: string) {
  const parsed = await validateCreateBody(rawBody);
  const { tagIds, ...pageData } = parsed;

  const created = await runWithSlugConflictHandling(() =>
    createPage({
      ...pageData,
      type: "PAGE",
      authorId,
    })
  );

  await applyTags(created.id, tagIds);
  return created;
}

/**
 * Update PAGE with tags, validate body with PageUpdateSchema.
 */
export async function updatePageService(id: string, rawBody: unknown) {
  const parsed = await validateUpdateBody(rawBody);

  const { tagIds = [], ...pageData } = parsed as typeof parsed & {
    tagIds?: string[];
  };

  const updated = await runWithSlugConflictHandling(() =>
    updatePage(id, { ...pageData, type: "PAGE" })
  );

  await applyTags(updated.id, tagIds);

  return updated;
}

/**
 * Delete page by id. Throws if not found.
 */
export async function deletePageService(id: string): Promise<void> {
  const existing = await getPageById(id, { type: "PAGE" });
  if (!existing) {
    throw new PageNotFoundError();
  }
  await deletePage(id);
}

/**
 * List pages with pagination (for admin).
 */
export async function listPagesService(page: number, limit: number) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const { items, total } = await listPages(skip, safeLimit);

  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    pages: Math.ceil(total / safeLimit),
  };
}
