import { normalizeTagIds, setTagsForPage } from "@/lib/repos";
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

export async function applyTags(pageId: string, tagIds: unknown): Promise<void> {
  const normalized = normalizeTagIds(tagIds);
  await setTagsForPage(pageId, normalized);
}

export async function validateCreateBody(rawBody: unknown) {
  try {
    return await PageSchema.validate(rawBody, {
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
}

export async function validateUpdateBody(rawBody: unknown) {
  try {
    return await PageUpdateSchema.validate(rawBody, {
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
