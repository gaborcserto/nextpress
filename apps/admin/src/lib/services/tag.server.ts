import { prisma } from "@nextpress/db/src/client";
import { tryCatch, unwrapResult } from "@nextpress/shared";

import { contentReadWhere, requireContentWrite, ContentNotFoundError, type ContentActor } from "@/lib/auth/content-access";
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
  listTagsWithUsage
} from "@/lib/repos";
import { slugify } from "@/lib/utils";
import { TagCreateSchema, TagIdsSchema } from "@/lib/validation";

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
    Array.isArray(error.errors)
  ) {
    const errors = error.errors;
    if (errors.length && errors.every((item): item is string => typeof item === "string")) {
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

  const deleted = await deleteTagRecord(id);
  if (!deleted) throw new NotFoundError("Tag not found");
}

/**
 * Get tags for a specific page.
 */
export async function getTagsForPageService(pageId: string, actor?: ContentActor | null): Promise<TagDto[]> {
  const page = await prisma.page.findFirst({ where: { id: pageId, ...contentReadWhere(actor) }, select: { id: true } });
  if (!page) throw new ContentNotFoundError();
  return unwrapResult(
    await tryCatch(getTagsForPage(pageId)),
    () => new Error("Failed to load tags for page")
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
  if (!parsed.success) throw new ValidationError("Invalid tag IDs");
  await setTagsForPage(pageId, parsed.data);
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
