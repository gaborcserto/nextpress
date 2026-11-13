import { PublicTaxonomyBatchSchema } from "@nextpress/shared/api-contracts";
import { beforeEach, expect, it, vi } from "vitest";

const { findTaxonomy, findPosts } = vi.hoisted(() => ({
  findTaxonomy: vi.fn(),
  findPosts: vi.fn(),
}));
vi.mock("@nextpress/db", () => ({
  prisma: {
    taxonomy: { findFirst: findTaxonomy },
    page: { findMany: findPosts },
  },
}));

import { GET } from "./route";

const taxonomy = { type: "TAG", slug: "news", name: "News" };
const post = {
  slug: "story",
  title: "Story",
  excerpt: "",
  publishedAt: new Date("2025-01-01"),
  author: null,
  taxonomies: [{ taxonomy }],
  cover: null,
};
const context = (type = "TAG", slug = "news") => ({
  params: Promise.resolve({ type, slug }),
});
const request = (query = "") =>
  new Request(`http://localhost/api/public/taxonomies/TAG/news${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  findTaxonomy.mockResolvedValue({ ...taxonomy, id: "private-id" });
  findPosts.mockResolvedValue([post]);
});

it("projects taxonomy and bounded public summaries independently of cookies", async () => {
  const response = await GET(request("?limit=1&offset=2"), context());
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(PublicTaxonomyBatchSchema.safeParse(body).success).toBe(true);
  expect(JSON.stringify(body)).not.toContain("private-id");
  expect(findTaxonomy).toHaveBeenCalledWith({
    where: { type: "TAG", slug: "news" },
    select: { type: true, slug: true, name: true },
  });
  expect(findPosts).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        type: "POST",
        status: "PUBLISHED",
        publishedAt: { not: null, lte: expect.any(Date) },
        taxonomies: { some: { taxonomy: { type: "TAG", slug: "news" } } },
      },
      take: 2,
      skip: 2,
      orderBy: [{ publishedAt: "desc" }, { slug: "asc" }],
      select: expect.not.objectContaining({ content: true, id: true }),
    }),
  );
});

it.each([
  "?limit=0",
  "?limit=51",
  "?offset=100001",
  "?limit=2&limit=3",
  "?offset=-1",
  "?secret=true",
])("rejects invalid query %s", async (query) => {
  expect((await GET(request(query), context())).status).toBe(400);
  expect(findPosts).not.toHaveBeenCalled();
});
it.each([
  ["PRIVATE", "news"],
  ["TAG", "../secret"],
  ["TAG", " news "],
])("rejects invalid taxonomy %s/%s", async (type, slug) => {
  expect((await GET(request(), context(type, slug))).status).toBe(404);
  expect(findTaxonomy).not.toHaveBeenCalled();
});
it("distinguishes missing definitions, empty archives and database failures", async () => {
  findTaxonomy.mockResolvedValueOnce(null);
  expect((await GET(request(), context())).status).toBe(404);
  expect(findPosts).not.toHaveBeenCalled();
  findPosts.mockResolvedValueOnce([]);
  expect(await (await GET(request(), context())).json()).toEqual({
    taxonomy,
    posts: [],
    hasMore: false,
  });
  findPosts.mockRejectedValueOnce(new Error("private-db-details"));
  const response = await GET(request(), context());
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private-db-details");
});
it("uses limit-plus-one without returning the extra record", async () => {
  findPosts.mockResolvedValue([post, { ...post, slug: "older" }]);
  expect(
    await (await GET(request("?limit=1"), context())).json(),
  ).toMatchObject({ posts: [{ slug: "story" }], hasMore: true });
});
it("filters assignments as well as publication status and scheduling", async () => {
  findPosts.mockImplementation(
    async (args: { where: unknown; take: number; skip: number }) => {
      expect(args.where).toEqual({
        type: "POST",
        status: "PUBLISHED",
        publishedAt: { not: null, lte: expect.any(Date) },
        taxonomies: { some: { taxonomy: { type: "TAG", slug: "news" } } },
      });
      const records = [
        { ...post, status: "PUBLISHED", assigned: true },
        { ...post, slug: "draft", status: "DRAFT", assigned: true },
        {
          ...post,
          slug: "scheduled",
          status: "PUBLISHED",
          publishedAt: new Date("2999-01-01"),
          assigned: true,
        },
        { ...post, slug: "unassigned", status: "PUBLISHED", assigned: false },
      ];

      return records
        .filter(
          (item) =>
            item.status === "PUBLISHED" &&
            item.publishedAt <= new Date() &&
            item.assigned,
        )
        .slice(args.skip, args.skip + args.take);
    },
  );
  const body = await (await GET(request(), context())).json();
  expect(body.posts.map((item: { slug: string }) => item.slug)).toEqual([
    "story",
  ]);
});
