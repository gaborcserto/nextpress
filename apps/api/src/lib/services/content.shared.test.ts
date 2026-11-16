import { EMPTY_RICH_CONTENT } from "@nextpress/shared/content";
import { describe, expect, it } from "vitest";

import {
  PageConflictError,
  PageNotFoundError,
  PageValidationError,
  runWithContentConflictHandling,
  validateCreateBody,
  validateUpdateBody,
} from "./content.shared";

describe("content service validation", () => {
  it("returns parsed create data with schema defaults", () => {
    expect(
      validateCreateBody({
        type: "POST",
        status: "PUBLISHED",
        slug: "article",
        title: "Article",
        tagIds: undefined,
      }),
    ).toMatchObject({
      excerpt: EMPTY_RICH_CONTENT,
      content: EMPTY_RICH_CONTENT,
      tagIds: [],
    });
  });

  it("exposes structured validation issues for invalid input", () => {
    expect(() => validateCreateBody({ title: "Missing fields" })).toThrow(
      PageValidationError,
    );
    try {
      validateUpdateBody({ slug: "   " });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PageValidationError);
      expect((error as PageValidationError).issues).toEqual(
        expect.arrayContaining([
          {
            path: "slug",
            message: "Too small: expected string to have >=1 characters",
          },
        ]),
      );
    }
  });
});

describe("content service boundaries", () => {
  it("maps only slug conflict failures and preserves other failures", async () => {
    await expect(
      runWithContentConflictHandling(async () => {
        throw { code: "SLUG_CONFLICT" };
      }),
    ).rejects.toBeInstanceOf(PageConflictError);

    const failure = new Error("database unavailable");
    await expect(
      runWithContentConflictHandling(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });

  it("keeps domain error types usable by callers", () => {
    expect(new PageNotFoundError().message).toBe("Page not found");
    expect(new PageConflictError().message).toBe("Slug already exists");
  });
});
