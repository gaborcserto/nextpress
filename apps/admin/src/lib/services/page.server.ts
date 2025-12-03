import { prisma } from "@nextpress/db/src/client";

import {
  createPage,
  updatePage,
  deletePage,
  listPages,
  getPageById,
  getTagsForPage,
  normalizeTagIds,
  setTagsForPage,
} from "@/lib/repos";
import { isSlugConflictError } from "@/lib/utils";
import {
  PageSchema,
  PageUpdateSchema,
  yupIssues,
  type ValidationIssue,
} from "@/lib/validation";

export class PageValidationError extends Error {
  constructor(public issues: ValidationIssue[]) {
    super("Validation failed");
    this.name = "PageValidationError";
  }
}

export class PageConflictError extends Error {
  constructor(message = "Slug already exists") {
    super(message);
    this.name = "PageConflictError";
  }
}

export class PageNotFoundError extends Error {
  constructor(message = "Page not found") {
    super(message);
    this.name = "PageNotFoundError";
  }
}

async function applyTags(pageId: string, tagIds: unknown): Promise<void> {
  const normalized = normalizeTagIds(tagIds);
  await setTagsForPage(pageId, normalized);
}

/**
 * Create a PAGE with tags, validate body with PageSchema.
 */
export async function createPageService(
  rawBody: unknown,
  authorId: string
) {
  let parsed: Awaited<ReturnType<typeof PageSchema.validate>>;

  try {
    parsed = await PageSchema.validate(rawBody, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (err: unknown) {
    const issues = yupIssues(err);
    if (issues) {
      throw new PageValidationError(issues);
    }
    throw err;
  }

  const { tagIds, ...pageData } = parsed;

  try {
    const created = await createPage({
      ...pageData,
      authorId,
    });

    await applyTags(created.id, tagIds);
    return created;
  } catch (err) {
    if (isSlugConflictError(err)) {
      throw new PageConflictError();
    }
    throw err;
  }
}

/**
 * Create a POST with tags, validate body with PageSchema.
 */
export async function createPostService(
  rawBody: unknown,
  authorId: string
) {
  let parsed: Awaited<ReturnType<typeof PageSchema.validate>>;

  try {
    parsed = await PageSchema.validate(rawBody, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (err: unknown) {
    const issues = yupIssues(err);
    if (issues) {
      throw new PageValidationError(issues);
    }
    throw err;
  }

  const { tagIds, ...pageData } = parsed;

  try {
    const created = await createPage({
      ...pageData,
      type: "POST",
      authorId,
    });

    await applyTags(created.id, tagIds);
    return created;
  } catch (err) {
    if (isSlugConflictError(err)) {
      throw new PageConflictError();
    }
    throw err;
  }
}

/**
 * Update PAGE/POST with tags, validate body with PageUpdateSchema.
 * kind = "PAGE" | "POST" only affects enforced type on update.
 */
export async function updatePageWithTagsService(
  kind: "PAGE" | "POST",
  id: string,
  rawBody: unknown
) {
  let parsed: Awaited<ReturnType<typeof PageUpdateSchema.validate>>;

  try {
    parsed = await PageUpdateSchema.validate(rawBody, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (err: unknown) {
    const issues = yupIssues(err);
    if (issues) {
      throw new PageValidationError(issues);
    }
    throw err;
  }

  const { tagIds = [], ...pageData } = parsed as typeof parsed & {
    tagIds?: string[];
  };

  try {
    const updated = await updatePage(
      id,
      kind === "POST" ? { ...pageData, type: "POST" } : pageData
    );

    await applyTags(updated.id, tagIds);

    return updated;
  } catch (err) {
    if (isSlugConflictError(err)) {
      throw new PageConflictError();
    }
    throw err;
  }
}

/**
 * Delete page or post by id. Throws if not found.
 */
export async function deletePageService(id: string): Promise<void> {
  const existing = await getPageById(id);
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
 */
export async function getPostWithTagsService(id: string) {
  const item = await getPageById(id, { type: "POST" });
  if (!item) {
    throw new PageNotFoundError();
  }

  const tags = await getTagsForPage(item.id);

  return { item, tags };
}
