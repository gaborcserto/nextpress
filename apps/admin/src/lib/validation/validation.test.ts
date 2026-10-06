import { describe, expect, it } from "vitest";

import {
  PageSchema,
  PageUpdateSchema,
  TagCreateSchema,
  TagIdsSchema,
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
      excerpt: "",
      content: "",
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
});
