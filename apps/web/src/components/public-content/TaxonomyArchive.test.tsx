import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { read, notFound, redirect } = vi.hoisted(() => ({
  read: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));
vi.mock("@/lib/content/public-content.server", () => ({
  getPublishedTaxonomyPosts: read,
}));
vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/lib/settings/public-site-settings.server", () => ({
  getPublicSiteSettings: async () => ({
    postsPerPage: 2,
    postListingMode: "LOAD_MORE",
    appearance: {
      websiteTemplate: "blog",
      stylePreset: "classic",
      colorMode: "light",
    },
  }),
}));

import { TaxonomyArchive, taxonomyArchiveMetadata } from "./TaxonomyArchive";

const taxonomy = { type: "CATEGORY", slug: "design", name: "Design" };
const post = {
  slug: "story",
  title: "Published story",
  summary: "",
  publishedAt: "2025-01-01T00:00:00Z",
  author: null,
  taxonomies: [taxonomy],
  cover: null,
};

const props = (page = "1") => ({
  type: "CATEGORY" as const,
  params: Promise.resolve({ slug: "design" }),
  searchParams: Promise.resolve({ page }),
});

beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue({ taxonomy, posts: [post], hasMore: true });
});

it("reuses the editorial archive with scoped pagination and taxonomy links", async () => {
  render(await TaxonomyArchive(props("2")));
  expect(
    screen.getByRole("heading", { level: 1, name: "Category: Design" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute(
    "href",
    "/categories/design",
  );
  expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
    "href",
    "/categories/design?page=3",
  );
  expect(screen.getByRole("link", { name: "Design" })).toHaveAttribute(
    "href",
    "/categories/design",
  );
  expect(read).toHaveBeenCalledWith("CATEGORY", "design", 2, 2);
});
it("canonicalizes each archive page and uses the real taxonomy name", async () => {
  const metadata = await taxonomyArchiveMetadata(props("2"));
  expect(metadata.title).toBe("Category: Design");
  expect(metadata.alternates?.canonical?.toString()).toBe(
    "http://localhost:49100/categories/design?page=2",
  );
});
it("renders an existing empty taxonomy without pagination", async () => {
  read.mockResolvedValue({ taxonomy, posts: [], hasMore: false });
  render(await TaxonomyArchive(props()));
  expect(screen.getByText("There are no published posts yet.")).toBeVisible();
  expect(
    screen.queryByRole("navigation", { name: "Post archive pages" }),
  ).not.toBeInTheDocument();
});
it("returns 404 for unavailable taxonomies, redirects exhausted pages and propagates failures", async () => {
  read.mockResolvedValueOnce(null);
  await expect(TaxonomyArchive(props())).rejects.toThrow("not-found");
  read.mockResolvedValueOnce({ taxonomy, posts: [], hasMore: false });
  await expect(TaxonomyArchive(props("3"))).rejects.toThrow(
    "redirect:/categories/design",
  );
  read.mockRejectedValueOnce(
    new Error("Public content is temporarily unavailable."),
  );
  await expect(TaxonomyArchive(props())).rejects.toThrow(
    "temporarily unavailable",
  );
});
