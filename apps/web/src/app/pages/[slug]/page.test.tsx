vi.mock("@/lib/i18n/server", () => ({ getLocale: async () => "en" }));
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPagePosts, getPublishedPage, notFound } = vi.hoisted(() => ({
  getPagePosts: vi.fn(),
  getPublishedPage: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("@/lib/content/public-content.server", () => ({
  getPagePosts,
  getPublishedPage,
}));
vi.mock("@/lib/settings/public-site-settings.server", () => ({
  getPublicSiteSettings: vi.fn().mockResolvedValue({
    postsPerPage: 2,
    postListingMode: "PAGINATION",
    appearance: {
      websiteTemplate: "blog",
      stylePreset: "classic",
      colorMode: "dark",
    },
  }),
}));
vi.mock("@/components/public-shell/PublicWebsiteShell", () => ({
  PublicWebsiteShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({ notFound }));

import StaticPage, { generateMetadata } from "./page";

import type { ReactNode } from "react";

const page = {
  slug: "about",
  title: "About us",
  summary: "A short introduction.",
  content: {
    version: 1 as const,
    blocks: [
      { type: "paragraph" as const, children: [{ text: "Page body." }] },
    ],
  },
  publishedAt: "2025-02-03T00:00:00.000Z",
  author: null,
  taxonomies: [],
  cover: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getPublishedPage.mockResolvedValue(page);
});

describe("Public static page", () => {
  it("shows the localized empty state and keeps the gallery body", async () => {
    getPublishedPage.mockResolvedValue({ ...page, pageType: "gallery" });

    render(await StaticPage({ params: Promise.resolve({ slug: "about" }) }));

    expect(screen.getByText("Page body.")).toBeVisible();
    expect(screen.getByText("This gallery is empty.")).toBeVisible();
  });

  it("uses the page's filter and offset and keeps pagination on its own URL", async () => {
    const listing = {
      ...page,
      pageType: "posts",
      postsFilter: { type: "TAG", slug: "news" },
    };
    getPublishedPage.mockResolvedValue(listing);
    getPagePosts.mockResolvedValue({
      posts: [{ ...page, title: "Matching post" }],
      hasMore: true,
    });

    render(
      await StaticPage({
        params: Promise.resolve({ slug: "about" }),
        searchParams: Promise.resolve({ page: "2" }),
      }),
    );

    expect(getPagePosts).toHaveBeenCalledWith(listing, 2, 2);
    expect(screen.getByRole("link", { name: "Matching post" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      "/en/pages/about",
    );
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/en/pages/about?page=3",
    );
  });

  it("renders a titled semantic page with safe rich content", async () => {
    render(await StaticPage({ params: Promise.resolve({ slug: "about" }) }));
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "About us" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Page body.")).toBeInTheDocument();
  });

  it("uses a shared unavailable response for missing and non-public pages", async () => {
    getPublishedPage.mockResolvedValue(null);
    await expect(
      StaticPage({ params: Promise.resolve({ slug: "unavailable" }) }),
    ).rejects.toThrow("not-found");
    expect(notFound).toHaveBeenCalled();
  });

  it("generates basic metadata from existing page fields", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "about" }) }),
    ).resolves.toEqual({
      title: "About us",
      description: "A short introduction.",
      alternates: {
        canonical: new URL("http://localhost:49100/en/pages/about"),
      },
      openGraph: {
        title: "About us",
        description: "A short introduction.",
        type: "website",
        url: new URL("http://localhost:49100/en/pages/about"),
      },
    });
    getPublishedPage.mockResolvedValue({ ...page, summary: "" });
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "about" }) }),
    ).resolves.toEqual({
      title: "About us",
      alternates: {
        canonical: new URL("http://localhost:49100/en/pages/about"),
      },
      openGraph: {
        title: "About us",
        type: "website",
        url: new URL("http://localhost:49100/en/pages/about"),
      },
    });
  });
});
