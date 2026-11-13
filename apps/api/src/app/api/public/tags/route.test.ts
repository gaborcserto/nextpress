import { PublicTagBatchSchema } from "@nextpress/shared/api-contracts";
import { beforeEach, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@nextpress/db", () => ({ prisma: { taxonomy: { findMany } } }));

import { GET } from "./route";

const tag = {
  type: "TAG",
  slug: "accessibility",
  name: "Accessibility",
  id: "private-id",
};
const request = (query = "") =>
  new Request(`http://localhost/api/public/tags${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  findMany.mockResolvedValue([tag]);
});

it("selects unique tags from published posts, with bounded ordered projection", async () => {
  const response = await GET(request("?limit=2&offset=4"));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(PublicTagBatchSchema.safeParse(body).success).toBe(true);
  expect(JSON.stringify(body)).not.toContain("private-id");
  expect(findMany).toHaveBeenCalledWith({
    where: {
      type: "TAG",
      pages: {
        some: {
          page: {
            type: "POST",
            status: "PUBLISHED",
            publishedAt: { not: null, lte: expect.any(Date) },
          },
        },
      },
    },
    orderBy: { slug: "asc" },
    take: 3,
    skip: 4,
    select: { type: true, slug: true, name: true },
  });
});
it.each([
  "?limit=0",
  "?limit=51",
  "?offset=100001",
  "?limit=2&limit=3",
  "?limit=NaN",
  "?offset=-1",
  "?internal=true",
])("rejects invalid pagination %s", async (query) => {
  expect((await GET(request(query))).status).toBe(400);
  expect(findMany).not.toHaveBeenCalled();
});
it("does not list draft-only, scheduled-only, page-only or unassigned tags", async () => {
  findMany.mockImplementation(
    async (args: { where: unknown; take: number; skip: number }) => {
      expect(args.where).toEqual({
        type: "TAG",
        pages: {
          some: {
            page: {
              type: "POST",
              status: "PUBLISHED",
              publishedAt: { not: null, lte: expect.any(Date) },
            },
          },
        },
      });
      const visible = {
        type: "POST",
        status: "PUBLISHED",
        publishedAt: new Date("2025-01-01"),
      };
      const records = [
        { ...tag, pages: [visible, visible] },
        { ...tag, slug: "draft", pages: [{ ...visible, status: "DRAFT" }] },
        {
          ...tag,
          slug: "scheduled",
          pages: [{ ...visible, publishedAt: new Date("2999-01-01") }],
        },
        { ...tag, slug: "page-only", pages: [{ ...visible, type: "PAGE" }] },
        { ...tag, slug: "unassigned", pages: [] },
      ];

      return records
        .filter((item) =>
          item.pages.some(
            (page) =>
              page.type === "POST" &&
              page.status === "PUBLISHED" &&
              page.publishedAt <= new Date(),
          ),
        )
        .slice(args.skip, args.skip + args.take);
    },
  );
  const body = await (await GET(request())).json();
  expect(body.tags.map((item: { slug: string }) => item.slug)).toEqual([
    "accessibility",
  ]);
});
it("paginates large collections, returns real empty results and propagates failures", async () => {
  findMany.mockResolvedValueOnce(
    Array.from({ length: 13 }, (_, index) => ({
      ...tag,
      slug: `tag-${index}`,
    })),
  );
  const largeBatch = await (await GET(request("?limit=12"))).json();
  expect(largeBatch.tags).toHaveLength(12);
  expect(largeBatch.hasMore).toBe(true);
  findMany.mockResolvedValueOnce([]);
  expect(await (await GET(request())).json()).toEqual({
    tags: [],
    hasMore: false,
  });
  findMany.mockRejectedValueOnce(new Error("private-db-info"));
  const response = await GET(request());
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private-db-info");
});
