import { describe, expect, it } from "vitest";

import {
  NavigationItemSchema,
  PageSchema,
  PageUpdateSchema,
  EditorialPostSchema,
  ApiErrorSchema,
  PublicContentSchema,
  PublicPostSummarySchema,
  ContentListSchema,
} from "./api-contracts";
import { readRichContent, serializeRichContent } from "./editorial/content";

describe("portable CMS contracts", () => {
  it("requires persisted publication date and the API publication projection in list rows", () => {
    const item = {
      id: "item",
      type: "PAGE",
      status: "PUBLISHED",
      publishedAt: null,
      publicationState: "MISSING_DATE",
      slug: "legacy",
      title: "Legacy",
      excerpt: null,
      updatedAt: "2026-01-01T00:00:00Z",
    };

    expect(
      ContentListSchema.safeParse({
        items: [item],
        page: 1,
        limit: 50,
        total: 1,
        pages: 1,
      }).success,
    ).toBe(true);
    expect(
      ContentListSchema.safeParse({
        items: [{ ...item, publishedAt: "invalid" }],
        page: 1,
        limit: 50,
        total: 1,
        pages: 1,
      }).success,
    ).toBe(false);
    expect(
      ContentListSchema.safeParse({
        items: [{ ...item, publishedAt: undefined }],
        page: 1,
        limit: 50,
        total: 1,
        pages: 1,
      }).success,
    ).toBe(false);
  });

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

  it("preserves explicit date clearing and tag removal in a partial update", () => {
    const input = { expectedVersion: 2, publishedAt: null, tagIds: [] };

    expect(PageUpdateSchema.parse(input)).toEqual(input);
    expect(PageUpdateSchema.safeParse({ ...input, tagIds: null }).success).toBe(
      false,
    );
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
    { scenario: "an omitted cover", response: summary },
    { scenario: "a null cover", response: { ...summary, cover: null } },
    {
      scenario: "public cover metadata",
      response: {
        ...summary,
        cover: {
          url: "/media/public-cover",
          alt: "Landscape",
          width: 800,
          height: 600,
        },
      },
    },
  ])("accepts $scenario", ({ response }) => {
    expect(PublicPostSummarySchema.safeParse(response).success).toBe(true);
  });

  it("rejects private fields and external cover URLs", () => {
    const cover = { url: "/media/a", alt: "", width: 1, height: 1 };
    const withExternalUrl = { ...cover, url: "https://external.test/a" };
    const withPrivateKey = { ...cover, key: "secret" };

    expect(
      PublicPostSummarySchema.safeParse({ ...summary, cover: withExternalUrl })
        .success,
    ).toBe(false);
    expect(
      PublicPostSummarySchema.safeParse({ ...summary, cover: withPrivateKey })
        .success,
    ).toBe(false);
  });

  it("requires a consumer-first rollout because old strict consumers reject cover", () => {
    const oldConsumer = PublicPostSummarySchema.omit({ cover: true });
    const expanded = { ...summary, cover: null };

    expect(PublicPostSummarySchema.safeParse(expanded).success).toBe(true);
    expect(oldConsumer.safeParse(expanded).success).toBe(false);
  });
});
describe("navigation items", () => {
  it("defaults item visibility on for existing menu clients", () => {
    const item = NavigationItemSchema.parse({
      id: "item",
      parentId: null,
      kind: "group",
      label: "Explore",
      value: "",
      newTab: false,
    });

    expect(item.visible).toBe(true);
  });
});
