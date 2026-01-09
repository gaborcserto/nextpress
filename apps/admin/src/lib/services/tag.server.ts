import { tryCatch, unwrapResult } from "@nextpress/shared";

import type {
  TagDto ,
  TagWithUsageDto
} from "@/lib/repos";
import {
  searchTagsRaw,
  findTagByNameInsensitive,
  findTagBySlug,
  createTagRecord,
  deleteTagRecord,
  getTagsForPage,
  setTagsForPage,
  normalizeTagIds,
  listTagsWithUsage
} from "@/lib/repos";
import { slugify } from "@/lib/utils";
import { TagCreateSchema } from "@/lib/validation";

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

/**
 * Extract a human-readable validation message from a Yup-like error.
 */
function getValidationMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray((error as { errors?: unknown }).errors)
  ) {
    const errors = (error as { errors?: string[] }).errors;
    if (errors?.length) return errors.join(", ");
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "Invalid tag data";
}

/**
 * Search tags by free-text query (name or slug).
 */
export async function searchTagsService(query: string): Promise<TagDto[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

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
  const [existing] = await tryCatch(findTagByNameInsensitive(name));
  if (existing) return existing;

  // 3) Generate unique slug
  let slugBase = slugify(name) || name.toLowerCase().replace(/\s+/g, "-");
  let slug = slugBase;
  let counter = 1;

  while (true) {
    const [found] = await tryCatch(findTagBySlug(slug));
    if (!found) break;
    slug = `${slugBase}-${++counter}`;
  }

  // 4) Create and return tag
  return unwrapResult(
    await tryCatch(createTagRecord(name, slug)),
    () => new Error("Failed to create tag")
  );
}

/**
 * Delete a tag by ID.
 */
export async function deleteTagService(rawId: string): Promise<void> {
  const id = rawId.trim();
  if (!id) throw new ValidationError("ID is required");

  const [deleted] = await tryCatch(deleteTagRecord(id));
  if (!deleted) throw new NotFoundError("Tag not found");
}

/**
 * Get tags for a specific page.
 */
export async function getTagsForPageService(pageId: string): Promise<TagDto[]> {
  return unwrapResult(
    await tryCatch(getTagsForPage(pageId)),
    () => new Error("Failed to load tags for page")
  );
}

/**
 * Replace all tags assigned to a page.
 * Accepts raw tag IDs and normalizes them before persisting.
 */
export async function setTagsForPageService(
  pageId: string,
  rawTagIds: unknown
): Promise<void> {
  const ids = normalizeTagIds(rawTagIds);

  unwrapResult(
    await tryCatch(setTagsForPage(pageId, ids)),
    () => new Error("Failed to update tags for page")
  );
}

/**
 * List all tags together with their usage count.
 * Used by the admin taxonomy screen.
 */
export async function listTagsWithUsageService(): Promise<TagWithUsageDto[]> {
  return unwrapResult(
    await tryCatch(listTagsWithUsage()),
    () => new Error("Failed to load tags")
  );
}
