import { describe, expect, it } from "vitest";

import {
  PageSchema,
  PageUpdateSchema,
  EditorialPostSchema,
  ApiErrorSchema,
  PublicContentSchema,
  PublicPostSummarySchema,
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
    expect(PageUpdateSchema.safeParse({}).success).toBe(false);
    expect(PageUpdateSchema.parse({ expectedVersion: 0 })).toEqual({
      expectedVersion: 0,
    });
  });
  it("keeps legacy editorial arrays distinct from delivery documents", () => {
    const content = readRichContent(
      '[{"type":"paragraph","children":[{"text":"legacy"}]}]',
    );
    const item = {
      status: "DRAFT",
      workingVersion: 0,
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

describe("summary cover compatibility", () => {
  const summary = {
    slug: "post",
    title: "Title",
    summary: "",
    publishedAt: "2026-01-01T00:00:00Z",
    author: null,
    taxonomies: [],
  };
  it.each([
    undefined,
    null,
    { url: "/media/public-cover", alt: "Landscape", width: 800, height: 600 },
  ])("accepts old and expanded responses %j", (cover) => {
    expect(
      PublicPostSummarySchema.safeParse({
        ...summary,
        ...(cover === undefined ? {} : { cover }),
      }).success,
    ).toBe(true);
  });
  it("rejects private fields and external cover URLs", () => {
    for (const cover of [
      { url: "https://external.test/a", alt: "", width: 1, height: 1 },
      { url: "/media/a", alt: "", width: 1, height: 1, key: "secret" },
    ]) {
      expect(
        PublicPostSummarySchema.safeParse({ ...summary, cover }).success,
      ).toBe(false);
    }
  });
});
it("requires a consumer-first rollout because old strict consumers reject cover", () => {
  const oldConsumer = PublicPostSummarySchema.omit({ cover: true });
  const expanded = {
    slug: "post",
    title: "Title",
    summary: "",
    publishedAt: "2026-01-01T00:00:00Z",
    author: null,
    taxonomies: [],
    cover: null,
  };
  expect(PublicPostSummarySchema.safeParse(expanded).success).toBe(true);
  expect(oldConsumer.safeParse(expanded).success).toBe(false);
});
