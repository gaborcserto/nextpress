import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const {
  getPublishedHome,
  getPublishedPosts,
  getPublishedTags,
  getPublicSiteSettings,
} = vi.hoisted(() => ({
  getPublishedHome: vi.fn().mockResolvedValue(null),
  getPublishedPosts: vi.fn().mockResolvedValue({ posts: [], hasMore: false }),
  getPublishedTags: vi.fn().mockResolvedValue({ tags: [], hasMore: false }),
  getPublicSiteSettings: vi.fn(),
}));

vi.mock("@/lib/content/public-content.server", () => ({
  getPublishedHome,
  getPublishedPosts,
  getPublishedTags,
}));
vi.mock("@/lib/settings/public-site-settings.server", () => ({
  getPublicSiteSettings,
}));
vi.mock("@/components/public-shell/PublicWebsiteShell", () => ({
  PublicWebsiteShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/public-content/PublishedPage", () => ({
  PublishedPage: ({ page }: { page: { title: string } }) => (
    <h1>{page.title}</h1>
  ),
}));

import Home from "./page";

import type { ReactNode } from "react";

describe("Home", () => {
  it("renders the published CMS homepage instead of the blog feed", async () => {
    getPublicSiteSettings.mockResolvedValueOnce({ siteName: "Field Notes" });
    getPublishedHome.mockResolvedValueOnce({
      title: "Welcome to Field Notes",
      content: {
        version: 1,
        blocks: [{ type: "paragraph", children: [{ text: "Welcome body" }] }],
      },
    });

    render(await Home());

    expect(
      screen.getByRole("heading", { name: "Welcome to Field Notes" }),
    ).toBeVisible();
    expect(screen.queryByText("Welcome body")).not.toBeInTheDocument();
    expect(getPublishedPosts).not.toHaveBeenCalled();
  });

  it("renders the configured publication and latest published post summaries", async () => {
    getPublishedHome.mockResolvedValueOnce(null);
    getPublicSiteSettings.mockResolvedValue({
      siteName: "Field Notes",
      siteDescription: "Stories from the field.",
    });
    getPublishedPosts.mockResolvedValue({
      posts: [
        {
          slug: "first-story",
          title: "A first story",
          summary: "A useful introduction.",
          publishedAt: "2025-02-03T00:00:00.000Z",
          author: { name: "A. Writer" },
          taxonomies: [{ type: "CATEGORY", slug: "essays", name: "Essays" }],
        },
      ],
      hasMore: false,
    });

    render(await Home());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Latest from the publication",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Stories from the field."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Latest post" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A first story" })).toHaveAttribute(
      "href",
      "/en/posts/first-story",
    );
    expect(screen.getByText("A useful introduction.")).toBeInTheDocument();
    expect(screen.getByText("By A. Writer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Essays" })).toHaveAttribute(
      "href",
      "/en/categories/essays",
    );
    expect(screen.getByText("February 3, 2025, 00:00")).toHaveAttribute(
      "datetime",
      "2025-02-03T00:00:00.000Z",
    );
    expect(screen.getByRole("link", { name: "All posts" })).toHaveAttribute(
      "href",
      "/en/posts",
    );
  });

  it("renders a useful empty state when there are no published posts", async () => {
    getPublishedHome.mockResolvedValueOnce(null);
    getPublicSiteSettings.mockResolvedValue({
      siteName: "Field Notes",
      siteDescription: "Stories from the field.",
    });
    getPublishedPosts.mockResolvedValue({ posts: [], hasMore: false });

    render(await Home());

    expect(
      screen.getByText("There are no published posts yet."),
    ).toBeInTheDocument();
  });
});

it("requests a bounded shared tag collection and preserves failure behavior", async () => {
  getPublishedHome.mockResolvedValueOnce(null);
  getPublishedTags.mockRejectedValueOnce(
    new Error("Public tags are temporarily unavailable."),
  );
  await expect(Home()).rejects.toThrow("temporarily unavailable");
  expect(getPublishedTags).toHaveBeenCalledWith({ limit: 12 });
});
