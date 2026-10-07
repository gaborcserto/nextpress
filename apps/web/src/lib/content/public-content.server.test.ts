import { serializeRichContent } from "@nextpress/shared/content";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, findMany } = vi.hoisted(() => ({ findFirst: vi.fn(), findMany: vi.fn() }));
vi.mock("@nextpress/db", () => ({ prisma: { page: { findFirst, findMany } } }));

import { getPublicPageNavigation, getPublishedPage, getPublishedPost, getPublishedPosts } from "./public-content.server";
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
  findFirst.mockResolvedValue(row);
  findMany.mockResolvedValue([]);
});

describe("public published content boundary", () => {
  it("reads only explicitly published pages whose publication time has arrived", async () => {
    expect(await getPublishedPage("published")).toMatchObject({ slug: "published", publishedAt: row.publishedAt.toISOString() });
    expect(findFirst).toHaveBeenCalledWith({
      where: { slug: "published", type: "PAGE", status: "PUBLISHED", publishedAt: { not: null, lte: expect.any(Date) } },
      select: expect.objectContaining({ content: true }),
    });
    const records: { slug: string; type: string; status: string; publishedAt: Date | null }[] = [
      { slug: "draft", type: "PAGE", status: "DRAFT", publishedAt: row.publishedAt },
      { slug: "future", type: "PAGE", status: "PUBLISHED", publishedAt: new Date("2999-01-01") },
      { slug: "null-date", type: "PAGE", status: "PUBLISHED", publishedAt: null },
      { slug: "wrong-type", type: "POST", status: "PUBLISHED", publishedAt: row.publishedAt },
    ];
    findFirst.mockImplementation(async ({ where }: { where: { slug: string; type: string; status: string; publishedAt: { not: null; lte: Date } } }) =>
      records.find((item) => item.slug === where.slug && item.type === where.type && item.status === where.status
        && item.publishedAt !== null && item.publishedAt <= where.publishedAt.lte) ?? null);
    for (const slug of ["missing", "draft", "future", "null-date", "wrong-type"]) {
      expect(await getPublishedPage(slug)).toBeNull();
    }
  });

  it("returns selected header and footer pages in deterministic title order", async () => {
    findMany.mockImplementation(async (args: {
      where: { type: string; status: string; publishedAt: { not: null; lte: Date }; OR: { inHeaderMenu?: boolean; inFooterMenu?: boolean }[] };
      orderBy: { title?: string; slug?: string }[];
      select: Record<string, unknown>;
    }) => {
      expect(args.where).toEqual({
        type: "PAGE", status: "PUBLISHED", publishedAt: { not: null, lte: expect.any(Date) },
        OR: [{ inHeaderMenu: true }, { inFooterMenu: true }],
      });
      expect(args.orderBy).toEqual([{ title: "asc" }, { slug: "asc" }]);
      expect(args.select).toEqual({ slug: true, title: true, inHeaderMenu: true, inFooterMenu: true });
      const eligible = [
        { slug: "z-contact", title: "Contact", inHeaderMenu: false, inFooterMenu: true, status: "PUBLISHED", publishedAt: new Date("2025-01-01") },
        { slug: "about", title: "About", inHeaderMenu: true, inFooterMenu: true, status: "PUBLISHED", publishedAt: new Date("2025-01-01") },
        { slug: "draft", title: "Draft", inHeaderMenu: true, inFooterMenu: true, status: "DRAFT", publishedAt: new Date("2025-01-01") },
        { slug: "future", title: "Future", inHeaderMenu: true, inFooterMenu: false, status: "PUBLISHED", publishedAt: new Date("2999-01-01") },
        { slug: "unlisted", title: "Unlisted", inHeaderMenu: false, inFooterMenu: false, status: "PUBLISHED", publishedAt: new Date("2025-01-01") },
      ];
      return eligible.filter((item) => item.status === args.where.status && item.publishedAt <= args.where.publishedAt.lte
        && args.where.OR.some((flag) => (flag.inHeaderMenu && item.inHeaderMenu) || (flag.inFooterMenu && item.inFooterMenu)))
        .sort((left, right) => left.title.localeCompare(right.title) || left.slug.localeCompare(right.slug))
        .map(({ slug, title, inHeaderMenu, inFooterMenu }) => ({ slug, title, inHeaderMenu, inFooterMenu }));
    });
    expect(await getPublicPageNavigation()).toEqual({
      header: [{ slug: "about", title: "About" }],
      footer: [{ slug: "about", title: "About" }, { slug: "z-contact", title: "Contact" }],
    });
  });

  it("reads only explicitly published posts whose publication time has arrived", async () => {
    expect(await getPublishedPost("published")).toMatchObject({ slug: "published" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { slug: "published", type: "POST", status: "PUBLISHED", publishedAt: { not: null, lte: expect.any(Date) } },
      select: expect.objectContaining({ content: true, cover: expect.any(Object) }),
    });
    findFirst.mockImplementation(async ({ where }: { where: { slug: string; type: string; status: string; publishedAt: { not: null; lte: Date } } }) => {
      const records: { slug: string; type: string; status: string; publishedAt: Date | null }[] = [
        { slug: "draft", type: "POST", status: "DRAFT", publishedAt: row.publishedAt },
        { slug: "future", type: "POST", status: "PUBLISHED", publishedAt: new Date("2999-01-01") },
        { slug: "null-date", type: "POST", status: "PUBLISHED", publishedAt: null },
        { slug: "wrong-type", type: "PAGE", status: "PUBLISHED", publishedAt: row.publishedAt },
      ];
      return records.find((item) => item.slug === where.slug && item.type === where.type && item.status === where.status
        && item.publishedAt !== null && item.publishedAt <= where.publishedAt.lte) ?? null;
    });
    for (const slug of ["missing", "draft", "future", "null-date", "wrong-type"]) {
      expect(await getPublishedPost(slug)).toBeNull();
    }
  });

  it("lists published summaries in stable order and reports whether another bounded batch exists", async () => {
    const now = new Date();
    const published = { ...row, excerpt: "A short summary", publishedAt: new Date(now.getTime() - 1000) };
    const publishedNext = { ...row, slug: "second", publishedAt: new Date(now.getTime() - 2000) };
    const future = { ...row, slug: "future", publishedAt: new Date(now.getTime() + 60_000) };
    const draft = { ...row, slug: "draft", status: "DRAFT" };
    findMany.mockImplementation(async (args: {
      where: { type: string; status: string; publishedAt: { not: null; lte: Date } };
      orderBy: ({ publishedAt: string } | { slug: string })[];
      skip: number;
      take: number;
      select: Record<string, unknown>;
    }) => {
      expect(args.where).toEqual({ type: "POST", status: "PUBLISHED", publishedAt: { not: null, lte: expect.any(Date) } });
      expect(args.orderBy).toEqual([{ publishedAt: "desc" }, { slug: "asc" }]);
      expect(args.skip).toBe(0);
      expect(args.take).toBe(2);
      expect(args.select).not.toHaveProperty("content");
      expect(args.select).not.toHaveProperty("cover");
      return [published, publishedNext, future, draft]
        .filter((item) => item.status === args.where.status
          && item.publishedAt !== null && item.publishedAt <= args.where.publishedAt.lte)
        .sort((left, right) => right.publishedAt!.getTime() - left.publishedAt!.getTime() || left.slug.localeCompare(right.slug))
        .slice(args.skip, args.skip + args.take)
        .map(({ slug, title, excerpt, publishedAt, author, taxonomies }) => ({ slug, title, excerpt, publishedAt, author, taxonomies }));
    });

    expect(await getPublishedPosts({ limit: 1 })).toEqual({
      posts: [{
        slug: "published", title: "Published", summary: "A short summary",
        publishedAt: published.publishedAt.toISOString(), author: { name: "Author" },
        taxonomies: [{ type: "TAG", name: "News", slug: "news" }],
      }],
      hasMore: true,
    });
  });

  it("caps batch size and offset and restores defaults for non-finite values", async () => {
    await getPublishedPosts({ limit: 500, offset: 1_000_000 });
    expect(findMany.mock.lastCall?.[0]).toMatchObject({ take: 51, skip: 100_000 });
    await getPublishedPosts({ limit: Number.NaN, offset: Number.NaN });
    expect(findMany.mock.lastCall?.[0]).toMatchObject({ take: 11, skip: 0 });
  });

  it.each(["UPPER", "bad/slug", "%2f", " padded "])("does not query invalid slug %s", async (slug) => {
    expect(await getPublishedPage(slug)).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "//external.test/image", "https://external.test/image", "/\\external.test/image"])("omits unsupported cover URL %s", async (url) => {
    findFirst.mockResolvedValue({ ...row, cover: { ...row.cover, url } });
    expect((await getPublishedPost("published"))?.cover).toBeNull();
  });

  it("keeps published records readable when body or summary content is corrupt", async () => {
    findFirst.mockResolvedValue({ ...row, content: '{"version":2}', excerpt: "[" });
    expect(await getPublishedPage("published")).toMatchObject({
      slug: "published", summary: "",
      content: { version: 1, blocks: [{ type: "paragraph", children: [{ text: "" }] }] },
    });
  });

  it("propagates database failures without treating them as missing content", async () => {
    findFirst.mockRejectedValue(new Error("Database unavailable"));
    await expect(getPublishedPage("published")).rejects.toThrow("Database unavailable");
  });
});

describe("public routes", () => {
  it("keeps pages, posts and application-owned root routes separate", () => {
    expect(publicContentPath("PAGE", "api")).toBe("/pages/api");
    expect(publicContentPath("POST", "hello")).toBe("/posts/hello");
    expect(() => publicContentPath("PAGE", "a/b")).toThrow();
  });
});
