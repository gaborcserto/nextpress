import { describe, expect, it } from "vitest";

import {
  PageSchema,
  PageUpdateSchema,
  EditorialPostSchema,
  ApiErrorSchema,
  PublicContentSchema,
} from "./api-contracts";
import { readRichContent, serializeRichContent } from "./content";
describe("portable CMS contracts", () => {
  it("preserves current write defaults, strips forged identity, and accepts versioned rich documents", () => {
    const content = serializeRichContent([
      { type: "paragraph", children: [{ text: "Body" }] },
    ]);
    const parsed = PageSchema.parse({
      type: "POST",
      status: "DRAFT",
      slug: "post",
      title: "Title",
      content,
      authorId: "forged",
      role: "ADMIN",
    });
    expect(parsed).not.toHaveProperty("authorId");
    expect(parsed).not.toHaveProperty("role");
    expect(parsed.tagIds).toEqual([]);
    expect(PageUpdateSchema.parse({})).toEqual({});
  });
  it("keeps legacy editorial arrays distinct from delivery documents", () => {
    const content = readRichContent(
      '[{"type":"paragraph","children":[{"text":"legacy"}]}]',
    );
    const item = {
      status: "DRAFT",
      slug: "legacy",
      title: "Legacy",
      excerpt: content.blocks,
      content: content.blocks,
      tags: [],
      publishedAt: null,
      cover: null,
    };
    expect(EditorialPostSchema.safeParse(item).success).toBe(true);
    expect(PublicContentSchema.safeParse(item).success).toBe(false);
  });
  it("preserves structured validation and simple errors", () => {
    expect(
      ApiErrorSchema.parse({
        error: "Validation failed",
        issues: [{ path: "slug", message: "Invalid" }],
      }),
    ).toHaveProperty("issues");
    expect(ApiErrorSchema.parse({ error: "Unauthorized" })).toEqual({
      error: "Unauthorized",
    });
  });
});
