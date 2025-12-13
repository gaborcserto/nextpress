import { normalizeTagIds, setTagsForPage } from "@/lib/repos";
import { isSlugConflictError } from "@/lib/utils";
import {
  PageSchema,
  PageUpdateSchema,
  zodIssues,
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

export async function applyTags(pageId: string, tagIds: unknown): Promise<void> {
  const normalized = normalizeTagIds(tagIds);
  await setTagsForPage(pageId, normalized);
}

export function validateCreateBody(rawBody: unknown) {
  const res = PageSchema.safeParse(rawBody);
  if (!res.success) {
    const issues = zodIssues(res.error) ?? [
      { path: null, message: "Validation failed" },
    ];
    throw new PageValidationError(issues);
  }
  return res.data;
}

export function validateUpdateBody(rawBody: unknown) {
  const res = PageUpdateSchema.safeParse(rawBody);
  if (!res.success) {
    const issues = zodIssues(res.error) ?? [
      { path: null, message: "Validation failed" },
    ];
    throw new PageValidationError(issues);
  }
  return res.data;
}

export async function runWithSlugConflictHandling<T>(
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isSlugConflictError(err)) {
      throw new PageConflictError();
    }
    throw err;
  }
}
