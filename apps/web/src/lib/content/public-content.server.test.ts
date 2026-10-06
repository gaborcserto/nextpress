import { serializeRichContent } from "@nextpress/shared/content";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, findMany } = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn() }));
vi.mock("@nextpress/db", () => ({ prisma: { page: { findUnique, findMany } } }));

import { getPublishedContent, getPublishedPosts } from "./public-content.server";
import { publicContentPath } from "./routes";

const row = {
  slug: "published", title: "Published", excerpt: "Legacy summary",
  content: serializeRichContent([{ type: "paragraph", children: [{ text: "Body", bold: true }] }]),
  publishedAt: new Date("2024-01-01T00:00:00Z"),
  author: { name: "Author", email: "private@example.test", role: "ADMIN", id: "private-id" },
  taxonomies: [{ taxonomy: { type: "TAG", name: "News", slug: "news", id: "private-id" } }],
  cover: { url: "/uploads/cover.png", alt: "Cover", mime: "image/png", width: 800, height: 600, key: "private-key", uploadedById: "private-id" },
  id: "private-id", status: "PUBLISHED", parentId: "private-parent", layout: "REDIRECT",
  redirectTo: "https://example.test", viewCount: 5, revisions: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  findUnique.mockResolvedValue(row);
  findMany.mockResolvedValue([]);
});

describe("public published content boundary", () => {
  it("lists only currently published posts with a bounded summary projection and stable order", async () => {
    const now = new Date();
    const published = { ...row, excerpt: "A short summary", publishedAt: new Date(now.getTime() - 1000) };
    const future = { ...row, slug: "future", publishedAt: new Date(now.getTime() + 60_000) };
    const draft = { ...row, slug: "draft", status: "DRAFT" };
    findMany.mockImplementation(async (args: {
      where: { type: string; status: string; publishedAt: { not: null; lte: Date } };
      orderBy: { publishedAt: string }[];
      take: number;
      select: Record<string, unknown>;
    }) => {
      expect(args.where).toEqual({ type: "POST", status: "PUBLISHED", publishedAt: { not: null, lte: expect.any(Date) } });
      expect(args.orderBy).toEqual([{ publishedAt: "desc" }, { slug: "asc" }]);
      expect(args.take).toBe(5);
      expect(args.select).not.toHaveProperty("content");
      expect(args.select).not.toHaveProperty("cover");
      const eligible = [published, future, draft].filter((item) => item.status === args.where.status
        && item.publishedAt !== null && item.publishedAt <= args.where.publishedAt.lte);
      return eligible.map(({ slug, title, excerpt, publishedAt, author, taxonomies }) => ({ slug, title, excerpt, publishedAt, author, taxonomies }));
    });

    expect(await getPublishedPosts()).toEqual([{
      slug: "published", title: "Published", summary: "A short summary",
      publishedAt: published.publishedAt.toISOString(), author: { name: "Author" },
      taxonomies: [{ type: "TAG", name: "News", slug: "news" }],
    }]);
  });

  it("caps listing reads and restores the default for non-finite limits", async () => {
    await getPublishedPosts(500);
    expect(findMany.mock.lastCall?.[0].take).toBe(50);
    await getPublishedPosts(Number.NaN);
    expect(findMany.mock.lastCall?.[0].take).toBe(5);
  });

  it.each(["PAGE", "POST"] as const)("queries only published %s content using explicit projections", async (type) => {
    const result = await getPublishedContent(type, "published");
    expect(findUnique).toHaveBeenCalledWith({
      where: { slug: "published", type, status: "PUBLISHED", OR: [{ publishedAt: null }, { publishedAt: { lte: expect.any(Date) } }] },
      select: {
        slug: true, title: true, excerpt: true, content: true, publishedAt: true,
        author: { select: { name: true } },
        taxonomies: { select: { taxonomy: { select: { type: true, slug: true, name: true } } } },
        cover: { select: { url: true, alt: true, mime: true, width: true, height: true } },
      },
    });
    expect(result).toEqual({
      slug: "published", title: "Published", summary: "Legacy summary",
      content: { version: 1, blocks: [{ type: "paragraph", children: [{ text: "Body", bold: true }] }] },
      publishedAt: "2024-01-01T00:00:00.000Z", author: { name: "Author" },
      taxonomies: [{ type: "TAG", name: "News", slug: "news" }],
      cover: { url: "/uploads/cover.png", alt: "Cover", width: 800, height: 600 },
    });
  });

  it("filters draft, future and wrong-type records and accepts historical null dates", async () => {
    const records = [
      { ...row, type: "POST", slug: "draft", status: "DRAFT" },
      { ...row, type: "POST", slug: "future", publishedAt: new Date("2999-01-01") },
      { ...row, type: "PAGE", slug: "wrong-type" },
      { ...row, type: "POST", slug: "historical", publishedAt: null },
    ];
    findUnique.mockImplementation(async ({ where }: { where: {
      slug: string; type: string; status: string;
      OR: ({ publishedAt: null } | { publishedAt: { lte: Date } })[];
    } }) => records.find((item) => item.slug === where.slug && item.type === where.type
      && item.status === where.status && where.OR.some(({ publishedAt }) =>
        publishedAt === null ? item.publishedAt === null
          : item.publishedAt !== null && item.publishedAt <= publishedAt.lte)) ?? null);
    for (const slug of ["missing", "draft", "future", "wrong-type"]) {
      expect(await getPublishedContent("POST", slug)).toBeNull();
    }
    expect(await getPublishedContent("POST", "historical")).toMatchObject({ slug: "historical", publishedAt: null });
  });

  it.each(["UPPER", "bad/slug", "%2f", " padded "])("does not query invalid slug %s", async (slug) => {
    expect(await getPublishedContent("PAGE", slug)).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "//external.test/image", "https://external.test/image", "/\\external.test/image"])("omits unsupported cover URL %s", async (url) => {
    findUnique.mockResolvedValue({ ...row, cover: { ...row.cover, url } });
    expect((await getPublishedContent("POST", "published"))?.cover).toBeNull();
  });

  it("preserves nullable legacy publication dates and authors", async () => {
    findUnique.mockResolvedValue({ ...row, publishedAt: null, author: null, cover: null });
    expect(await getPublishedContent("PAGE", "published")).toMatchObject({ publishedAt: null, author: null, cover: null });
  });

  it("keeps published records readable when body or summary content is corrupt", async () => {
    findUnique.mockResolvedValue({ ...row, content: '{"version":2}', excerpt: "[" });
    expect(await getPublishedContent("PAGE", "published")).toMatchObject({
      slug: "published", summary: "",
      content: { version: 1, blocks: [{ type: "paragraph", children: [{ text: "" }] }] },
    });
  });

  it("propagates database failures without treating them as missing content", async () => {
    findUnique.mockRejectedValue(new Error("Database unavailable"));
    await expect(getPublishedContent("PAGE", "published")).rejects.toThrow("Database unavailable");
  });
});

describe("public routes", () => {
  it("keeps pages, posts and application-owned root routes separate", () => {
    expect(publicContentPath("PAGE", "api")).toBe("/pages/api");
    expect(publicContentPath("POST", "hello")).toBe("/posts/hello");
    expect(() => publicContentPath("PAGE", "a/b")).toThrow();
  });
});
