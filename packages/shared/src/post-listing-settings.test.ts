import { describe, expect, it } from "vitest";

import {
  DEFAULT_POSTS_PER_PAGE,
  MAX_POSTS_PER_PAGE,
  MIN_POSTS_PER_PAGE,
  PostListingModeSchema,
  PostsPerPageSchema,
  normalizePostsPerPage,
} from "./post-listing-settings";

describe("post listing settings", () => {
  it("allows only the supported public listing modes", () => {
    expect(PostListingModeSchema.parse("PAGINATION")).toBe("PAGINATION");
    expect(PostListingModeSchema.parse("LOAD_MORE")).toBe("LOAD_MORE");
    expect(PostListingModeSchema.safeParse("INFINITE_SCROLL").success).toBe(false);
  });

  it("bounds integer batch sizes and normalizes invalid stored values", () => {
    expect(PostsPerPageSchema.parse(MIN_POSTS_PER_PAGE)).toBe(1);
    expect(PostsPerPageSchema.parse(MAX_POSTS_PER_PAGE)).toBe(50);
    expect(PostsPerPageSchema.safeParse(0).success).toBe(false);
    expect(PostsPerPageSchema.safeParse(51).success).toBe(false);
    expect(PostsPerPageSchema.safeParse(1.5).success).toBe(false);
    expect(normalizePostsPerPage(500)).toBe(DEFAULT_POSTS_PER_PAGE);
  });
});
