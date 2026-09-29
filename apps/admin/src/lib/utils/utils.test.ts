import { describe, expect, it } from "vitest";

import { isSlugConflictError, slugify } from "./index";

describe("slugify", () => {
  it("normalizes accents, whitespace, punctuation, and repeated hyphens", () => {
    expect(slugify("  Crème brûlée: News!  ")).toBe("creme-brulee-news");
    expect(slugify("multiple   spaces---here")).toBe("multiple-spaces-here");
  });

  it("returns an empty slug when no URL-safe characters remain", () => {
    expect(slugify("!? ")).toBe("");
  });
});

describe("isSlugConflictError", () => {
  it("recognizes only objects with the conflict code", () => {
    expect(isSlugConflictError({ code: "SLUG_CONFLICT" })).toBe(true);
    expect(isSlugConflictError({ code: "OTHER" })).toBe(false);
    expect(isSlugConflictError(new Error("conflict"))).toBe(false);
    expect(isSlugConflictError(null)).toBe(false);
  });
});
