import {
  PublicContentSchema,
  PublicPostBatchSchema,
  PublicNavigationSchema,
  PublicContentIndexSchema,
} from "@nextpress/shared/api-contracts";
import { beforeEach, expect, it, vi } from "vitest";

import { GET as index } from "./content/route";
import { GET as navigation } from "./navigation/route";
import { GET as page } from "./pages/[slug]/route";
import { GET as post } from "./posts/[slug]/route";
import { GET as posts } from "./posts/route";
import {
  baselineInstant,
  editorialFixtures,
  publicBaseline,
} from "../../../../../../e2e/editorial-baseline";

const { findFirst, findMany } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock("@nextpress/db", () => ({ prisma: { page: { findFirst, findMany } } }));
vi.mock("@nextpress/db/src/client", () => ({
  prisma: { page: { findFirst, findMany } },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

it.each([page, post])(
  "captures semantic HTTP detail without private history",
  async (handler) => {
    const fixture = editorialFixtures[1];
    findFirst.mockResolvedValue(fixture);
    const response = await handler(
      new Request("http://localhost/api/public/pages/baseline"),
      { params: Promise.resolve({ slug: "baseline" }) },
    );

    const baseline = await publicBaseline(response, (body) =>
      PublicContentSchema.parse(body),
    );
    expect(baseline.status).toBe(200);
    expect(baseline.body).toMatchObject({
      title: fixture?.title,
      author: null,
      taxonomies: [{ type: "TAG" }, { type: "CATEGORY" }],
    });
    expect(JSON.stringify(baseline.body)).not.toContain("Newer private title");
    expect(baseline.hash).toMatch(/^[a-f0-9]{64}$/);
  },
);

it("captures bounded listing metadata, navigation, and shared sitemap/listing index inputs", async () => {
  const fixture = editorialFixtures[1];
  findMany.mockResolvedValue([fixture, fixture]);
  const listing = await publicBaseline(
    await posts(new Request("http://localhost/api/public/posts?limit=1")),
    (body) => PublicPostBatchSchema.parse(body),
  );
  expect(listing.body).toMatchObject({
    hasMore: true,
    posts: [{ slug: fixture?.slug }],
  });
  findMany.mockResolvedValue([
    { slug: "menu", title: "Menu", inHeaderMenu: true, inFooterMenu: false },
  ]);
  const menu = await publicBaseline(await navigation(), (body) =>
    PublicNavigationSchema.parse(body),
  );
  expect(menu.body).toEqual({
    header: [{ slug: "menu", title: "Menu" }],
    footer: [],
  });
  findMany.mockResolvedValue([
    {
      type: "POST",
      slug: "index",
      title: "Index",
      updatedAt: new Date(baselineInstant),
    },
  ]);
  const content = await publicBaseline(
    await index(
      new Request(
        "http://localhost/api/public/content?kind=POST&limit=1&taxonomyId=tag",
      ),
    ),
    (body) => PublicContentIndexSchema.parse(body),
  );
  expect(content.body).toEqual({
    items: [
      {
        type: "POST",
        slug: "index",
        title: "Index",
        updatedAt: baselineInstant,
      },
    ],
    hasMore: false,
  });
  expect(findMany.mock.lastCall?.[0]).toMatchObject({
    where: {
      type: "POST",
      status: "PUBLISHED",
      publishedAt: { not: null, lte: expect.any(Date) },
      taxonomies: { some: { taxonomyId: "tag" } },
    },
    take: 2,
    skip: 0,
    orderBy: [{ publishedAt: "desc" }, { slug: "asc" }],
  });
});

it("keeps private negative responses in a separate manifest", async () => {
  findFirst.mockResolvedValue(null);
  const response = await page(
    new Request("http://localhost/api/public/pages/private"),
    { params: Promise.resolve({ slug: "private" }) },
  );
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Not Found" });
});
