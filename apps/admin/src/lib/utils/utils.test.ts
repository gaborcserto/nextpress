import { describe, expect, it } from "vitest";

import { slugify } from "./index";

describe("slugify", () => {
  it("normalizes accents, whitespace, punctuation, and repeated hyphens", () => {
    expect(slugify("  Crème brûlée: News!  ")).toBe("creme-brulee-news");
    expect(slugify("multiple   spaces---here")).toBe("multiple-spaces-here");
  });

  it("returns an empty slug when no URL-safe characters remain", () => {
    expect(slugify("!? ")).toBe("");
  });
});
