import {
  PublicContentSchema,
  PublicPostBatchSchema,
  PublicNavigationSchema,
  PublicSiteSettingsSchema,
  ApiErrorSchema,
} from "@nextpress/shared/api-contracts";
import { serializeRichContent } from "@nextpress/shared/content";
import { beforeEach, expect, it, vi } from "vitest";

const { findFirst, findMany, findUnique, authenticate } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  authenticate: vi.fn(),
}));
vi.mock("@nextpress/db", () => ({
  prisma: { page: { findFirst, findMany }, siteSettings: { findUnique } },
}));
vi.mock("@/lib/auth/auth-server", () => ({ getSessionWithRole: authenticate }));
import { GET as navigation } from "./navigation/route";
import { GET as page } from "./pages/[slug]/route";
import { GET as post } from "./posts/[slug]/route";
import { GET as posts } from "./posts/route";
import { GET as settings } from "./settings/route";
const row = {
  slug: "published",
  title: "Published",
  excerpt: "Summary",
  content: serializeRichContent([
    { type: "paragraph", children: [{ text: "Body" }] },
  ]),
  publishedAt: new Date("2020-01-01"),
  author: { name: "Writer", email: "secret-email" },
  taxonomies: [],
  cover: {
    mime: "image/png",
    url: "/cover.png",
    alt: null,
    width: 1,
    height: 1,
    key: "secret-key",
  },
  status: "PUBLISHED",
  authorId: "secret-id",
};
beforeEach(() => {
  vi.resetAllMocks();
  findFirst.mockResolvedValue(row);
  findMany.mockResolvedValue([row]);
  findUnique.mockResolvedValue({
    siteName: "Site",
    siteDescription: "Text",
    postListingMode: "PAGINATION",
    postsPerPage: 10,
    clientSecret: "secret-provider",
  });
});
it.each(["", "better-auth.session_token=admin-cookie"])(
  "returns conformant public HTTP payloads independently of cookies: %s",
  async (cookie) => {
    const req = new Request("http://localhost/api/public/posts", {
      headers: { cookie },
    });
    for (const handler of [post, page]) {
      const response = await handler(req, {
        params: Promise.resolve({ slug: "published" }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const payload = await response.json();
      expect(PublicContentSchema.safeParse(payload).success).toBe(true);
      expect(JSON.stringify(payload)).not.toContain("secret-");
    }
    expect(
      PublicPostBatchSchema.safeParse(await (await posts(req)).json()).success,
    ).toBe(true);
    findMany.mockResolvedValue([]);
    expect(
      PublicNavigationSchema.safeParse(await (await navigation()).json())
        .success,
    ).toBe(true);
    const payload = await (await settings()).json();
    expect(PublicSiteSettingsSchema.safeParse(payload).success).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("secret-");
    expect(authenticate).not.toHaveBeenCalled();
  },
);
it.each([
  "limit=0",
  "limit=51",
  "offset=100001",
  "limit=2&limit=3",
  "offset=-1",
  "limit=1.5",
  "limit=",
])("rejects invalid pagination %s", async (query) => {
  const response = await posts(
    new Request(`http://localhost/api/public/posts?${query}`),
  );
  expect(response.status).toBe(400);
  expect(ApiErrorSchema.safeParse(await response.json()).success).toBe(true);
  expect(findMany).not.toHaveBeenCalled();
});
it("returns stable missing and failure errors", async () => {
  findFirst.mockResolvedValue(null);
  expect(
    (
      await post(new Request("http://localhost"), {
        params: Promise.resolve({ slug: "missing" }),
      })
    ).status,
  ).toBe(404);
  findFirst.mockRejectedValue(new Error("private SQL detail"));
  const response = await page(new Request("http://localhost"), {
    params: Promise.resolve({ slug: "missing" }),
  });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Unexpected error" });
});

it("does not substitute default settings during a database outage", async () => {
  findUnique.mockRejectedValueOnce(new Error("ECONNREFUSED private database"));
  const response = await settings();

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Unexpected error" });
});
