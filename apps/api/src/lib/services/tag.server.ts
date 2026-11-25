import { prisma } from "@nextpress/db/src/client";
import { tryCatch, unwrapResult } from "@nextpress/shared";
import { slugify } from "@nextpress/shared/slugify";

import {
  contentReadWhere,
  requireContentWrite,
  ContentNotFoundError,
  type ContentActor,
} from "@/lib/auth/content-access";
import {
  searchTagsRaw,
  findTagByNameInsensitive,
  findTagBySlug,
  createTagRecord,
  deleteTagRecord,
  getTagsForPage,
  setTagsForPage,
  listTagsWithUsage,
} from "@/lib/repos";
import {
  TagCreateSchema,
  TagIdsSchema,
  TagUpdateSchema,
} from "@/lib/validation";

import type { TagDto, TagWithUsageDto } from "@/lib/repos";

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class TaxonomyConflictError extends Error {}

/**
 * Extract a human-readable validation message from a Yup-like error.
 */
function getValidationMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray(error.errors)
  ) {
    const errors = error.errors;

    if (
      errors.length &&
      errors.every((item): item is string => typeof item === "string")
    ) {
      return errors.join(", ");
    }
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Invalid tag data";
}

/**
 * Search tags by free-text query (name or slug).
 */
export async function searchTagsService(query: string): Promise<TagDto[]> {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const slugified =
    slugify(trimmed) || trimmed.toLowerCase().replace(/\s+/g, "-");

  const [tags, err] = await tryCatch(searchTagsRaw(slugified));

  if (err || !tags) {
    throw new Error("Failed to search tags");
  }

  return tags;
}

/**
 * Create a new tag or return the existing one with the same name.
 */
export async function createTagService(rawName: string): Promise<TagDto> {
  // 1) Validate with Zod
  const parsed = TagCreateSchema.safeParse({ name: rawName });

  if (!parsed.success) {
    throw new ValidationError(getValidationMessage(parsed.error));
  }

  const name = parsed.data.name;

  // 2) Return existing if one matches case-insensitively
  const existing = await findTagByNameInsensitive(name);

  if (existing) {
    return existing;
  }

  // 3) Generate unique slug
  const slugBase = slugify(name) || name.toLowerCase().replace(/\s+/g, "-");
  let slug = slugBase;
  let counter = 1;

  while (counter <= 10) {
    const found = await findTagBySlug(slug);

    if (!found) {
      break;
    }

    slug = `${slugBase}-${++counter}`;
  }

  if (counter > 10) {
    throw new ValidationError("Unable to create tag with this name");
  }

  // 4) Create and return tag
  return createTagRecord(name, slug);
}

/**
 * Delete a tag by ID.
 */
export async function deleteTagService(rawId: string): Promise<void> {
  const id = rawId.trim();

  if (!id) {
    throw new ValidationError("ID is required");
  }

  const deleted = await deleteTagRecord(id);

  if (!deleted) {
    throw new NotFoundError("Tag not found");
  }
}

export async function deleteCategoryService(rawId: string): Promise<void> {
  const id = rawId.trim();

  if (!id) {
    throw new ValidationError("ID is required");
  }

  const category = await prisma.taxonomy.deleteMany({
    where: {
      id,
      type: "CATEGORY",
      pages: { none: {} },
      Page: { none: {} },
      back_ContentRevisionTaxonomy_target: { none: {} },
      privateWorkingReferences: { none: {} },
    },
  });

  if (!category.count) {
    const existing = await prisma.taxonomy.findUnique({
      where: { id, type: "CATEGORY" },
      select: { id: true },
    });

    if (existing) {
      throw new TaxonomyConflictError(
        "Remove content references before deleting this category",
      );
    }

    throw new NotFoundError("Category not found");
  }
}

export async function createCategoryService(input: unknown): Promise<TagDto> {
  const parsed = TagUpdateSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError(getValidationMessage(parsed.error));
  }

  const { name, slug } = parsed.data;
  const duplicate = await prisma.taxonomy.findFirst({
    where: { type: "CATEGORY", name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });

  if (duplicate) {
    throw new TaxonomyConflictError("A category with this name already exists");
  }

  try {
    const category = await prisma.taxonomy.create({
      data: { type: "CATEGORY", name, slug },
    });

    return { id: category.id, name: category.name, slug: category.slug };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      throw new TaxonomyConflictError("This taxonomy slug already exists");
    }

    throw error;
  }
}

export async function updateTagService(
  rawId: string,
  rawInput: unknown,
): Promise<TagDto> {
  const id = rawId.trim();
  const parsed = TagUpdateSchema.safeParse(rawInput);

  if (!id || !parsed.success) {
    throw new ValidationError(
      parsed.success ? "ID is required" : getValidationMessage(parsed.error),
    );
  }

  const existing = await prisma.taxonomy.findFirst({
    where: { id },
    select: { type: true },
  });

  if (!existing) {
    throw new NotFoundError("Tag not found");
  }

  const duplicate = await prisma.taxonomy.findFirst({
    where: {
      type: existing.type,
      id: { not: id },
      OR: [
        { name: { equals: parsed.data.name, mode: "insensitive" } },
        { slug: parsed.data.slug },
      ],
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ValidationError("A tag with this name or slug already exists");
  }

  try {
    const updated = await prisma.taxonomy.update({
      where: { id, type: existing.type },
      data: parsed.data,
    });

    return { id: updated.id, name: updated.name, slug: updated.slug };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new ValidationError("A tag with this name or slug already exists");
    }

    throw error;
  }
}

/**
 * Get tags for a specific page.
 */
export async function getTagsForPageService(
  pageId: string,
  actor?: ContentActor | null,
): Promise<TagDto[]> {
  const page = await prisma.page.findFirst({
    where: { id: pageId, ...contentReadWhere(actor) },
    select: { id: true },
  });

  if (!page) {
    throw new ContentNotFoundError();
  }

  return unwrapResult(
    await tryCatch(getTagsForPage(pageId)),
    () => new Error("Failed to load tags for page"),
  );
}

/**
 * Replace all tags assigned to a page.
 * Validates tag IDs and content ownership before persisting.
 */
export async function setTagsForPageService(
  pageId: string,
  rawTagIds: unknown,
  actor: ContentActor,
): Promise<void> {
  await requireContentWrite(pageId, actor);
  const parsed = TagIdsSchema.safeParse(rawTagIds);

  if (!parsed.success) {
    throw new ValidationError("Invalid tag IDs");
  }

  await setTagsForPage(pageId, parsed.data, undefined, actor);
}

/**
 * List all tags together with their usage count.
 * Used by the admin taxonomy screen.
 */
export async function listTagsWithUsageService(): Promise<TagWithUsageDto[]> {
  return unwrapResult(
    await tryCatch(listTagsWithUsage()),
    () => new Error("Failed to load tags"),
  );
}
