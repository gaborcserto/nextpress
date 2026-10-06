import { EMPTY_RICH_CONTENT } from "@nextpress/shared/content";
import { describe, expect, it } from "vitest";

import {
  PageSchema,
  PageUpdateSchema,
  TagCreateSchema,
  TagIdsSchema,
  parsePagination,
} from "./index";

describe("content validation", () => {
  it("trims required page fields and applies empty defaults", () => {
    expect(
      PageSchema.parse({
        type: "PAGE",
        status: "DRAFT",
        slug: "  welcome  ",
        title: "  Welcome  ",
        tagIds: undefined,
      })
    ).toEqual({
      type: "PAGE",
      status: "DRAFT",
      slug: "welcome",
      title: "Welcome",
      excerpt: EMPTY_RICH_CONTENT,
      content: EMPTY_RICH_CONTENT,
      tagIds: [],
    });
  });

  it("rejects missing required fields and unsupported enum values", () => {
    const result = PageSchema.safeParse({
      type: "ARTICLE",
      status: "DRAFT",
      slug: "",
      title: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts partial updates while still validating provided values", () => {
    expect(PageUpdateSchema.parse({ status: "PUBLISHED" })).toEqual({
      status: "PUBLISHED",
    });
    expect(PageUpdateSchema.parse({ tagIds: [] })).toEqual({ tagIds: [] });
    expect(PageUpdateSchema.safeParse({ slug: "   " }).success).toBe(false);
  });

  it("normalizes tag ids and defaults an omitted list", () => {
    expect(TagIdsSchema.parse(["  first  ", "second"])).toEqual(["first", "second"]);
    expect(TagIdsSchema.parse(undefined)).toEqual([]);
    expect(TagIdsSchema.safeParse(["", "valid"]).success).toBe(false);
  });

  it("trims tag names and rejects blank names", () => {
    expect(TagCreateSchema.parse({ name: "  News " })).toEqual({ name: "News" });
    expect(TagCreateSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("bounds persisted content and tag collections and rejects duplicate references", () => {
    const validPage = { type: "PAGE", status: "DRAFT", slug: "ok", title: "Okay" };
    expect(PageSchema.safeParse({ ...validPage, title: "x".repeat(301) }).success).toBe(false);
    expect(PageSchema.safeParse({ ...validPage, content: "x".repeat(1_000_001) }).success).toBe(false);
    expect(TagIdsSchema.safeParse(Array.from({ length: 101 }, (_, index) => `tag-${index}`)).success).toBe(false);
    expect(TagIdsSchema.safeParse(["same", "same"]).success).toBe(false);
    expect(PageSchema.safeParse({ ...validPage, title: "x".repeat(300), tagIds: Array.from({ length: 100 }, (_, index) => `tag-${index}`) }).success).toBe(true);
  });

  it("accepts only safe bounded positive pagination integers", () => {
    expect(parsePagination(new URLSearchParams())).toEqual({ page: 1, limit: 50 });
    expect(parsePagination(new URLSearchParams("page=2&limit=100"))).toEqual({ page: 2, limit: 100 });
    for (const query of ["page=0", "page=-1", "page=1x", "page=Infinity", "page=10001", "limit=0", "limit=101", "limit=NaN"]) {
      expect(parsePagination(new URLSearchParams(query))).toBeNull();
    }
  });
});
