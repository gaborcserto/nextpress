import { beforeEach, expect, it, vi } from "vitest";

const { count, findMany, taxonomy } = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  taxonomy: vi.fn(),
}));
vi.mock("@nextpress/db", () => ({
  prisma: { page: { count, findMany }, taxonomy: { findMany: taxonomy } },
}));

import { searchPublishedContent } from "./search.server";

beforeEach(() => {
  vi.resetAllMocks();
  taxonomy.mockResolvedValue([]);
  count.mockResolvedValue(0);
  findMany.mockResolvedValue([]);
});

it("never queries content for empty input and excludes unused taxonomies", async () => {
  expect((await searchPublishedContent({})).results).toEqual([]);
  expect(findMany).not.toHaveBeenCalled();
  expect(taxonomy.mock.calls[0][0].where.pages.some.page).toMatchObject({
    type: "POST",
    status: "PUBLISHED",
    publishedAt: { not: null, lte: expect.any(Date) },
  });
});

it("applies publication, type, taxonomy and bounded pagination before selecting public fields", async () => {
  await searchPublishedContent({
    q: "react",
    type: "posts",
    category: "news",
    tag: "js",
    sort: "newest",
    page: 2,
  });
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      skip: 10,
      take: 10,
      orderBy: [{ publishedAt: "desc" }, { slug: "asc" }],
      where: expect.objectContaining({
        status: "PUBLISHED",
        type: "POST",
        publishedAt: { not: null, lte: expect.any(Date) },
        AND: [
          {
            type: "POST",
            taxonomies: {
              some: { taxonomy: { type: "CATEGORY", slug: "news" } },
            },
          },
          {
            type: "POST",
            taxonomies: { some: { taxonomy: { type: "TAG", slug: "js" } } },
          },
        ],
      }),
    }),
  );
  expect(findMany.mock.calls[0][0].select).not.toHaveProperty("content");
  expect(findMany.mock.calls[0][0].where.OR).toHaveLength(4);
});

it("ranks title matches first and offsets the disjoint body tier correctly", async () => {
  count.mockResolvedValueOnce(15).mockResolvedValueOnce(12);
  const row = {
    type: "PAGE",
    title: "React",
    slug: "react",
    excerpt: "Summary",
    publishedAt: new Date("2025-01-01"),
    taxonomies: [],
  };
  findMany
    .mockResolvedValueOnce([row, { ...row, slug: "other" }])
    .mockResolvedValueOnce([]);
  const result = await searchPublishedContent({ q: "react", page: 2 });
  expect(result.results[0]).toMatchObject({ type: "PAGE", summary: "Summary" });
  expect(findMany.mock.calls[1][0]).toMatchObject({
    skip: 0,
    take: 8,
    where: {
      AND: [
        expect.anything(),
        { NOT: { title: { contains: "react", mode: "insensitive" } } },
      ],
    },
  });
});

it("validates before database work and propagates failures to the route boundary", async () => {
  await expect(
    searchPublishedContent({ q: "x".repeat(201) }),
  ).rejects.toThrow();
  expect(taxonomy).not.toHaveBeenCalled();
  taxonomy.mockRejectedValueOnce(new Error("database detail"));
  await expect(searchPublishedContent({ q: "react" })).rejects.toThrow();
});
