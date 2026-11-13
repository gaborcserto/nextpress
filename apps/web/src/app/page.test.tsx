import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { getPublishedPosts, getPublishedTags, getPublicSiteSettings } =
  vi.hoisted(() => ({
    getPublishedPosts: vi.fn(),
    getPublishedTags: vi.fn().mockResolvedValue({ tags: [], hasMore: false }),
    getPublicSiteSettings: vi.fn(),
  }));

vi.mock("@/lib/content/public-content.server", () => ({
  getPublishedPosts,
  getPublishedTags,
}));
vi.mock("@/lib/settings/public-site-settings.server", () => ({
  getPublicSiteSettings,
}));
vi.mock("@/components/public-shell/PublicWebsiteShell", () => ({
  PublicWebsiteShell: ({ children }: { children: ReactNode }) => children,
}));

import Home from "./page";

import type { ReactNode } from "react";

describe("Home", () => {
  it("renders the configured publication and latest published post summaries", async () => {
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
      "/posts/first-story",
    );
    expect(screen.getByText("A useful introduction.")).toBeInTheDocument();
    expect(screen.getByText("By A. Writer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Essays" })).toHaveAttribute(
      "href",
      "/categories/essays",
    );
    expect(screen.getByText("February 3, 2025")).toHaveAttribute(
      "datetime",
      "2025-02-03T00:00:00.000Z",
    );
    expect(screen.getByRole("link", { name: "All posts" })).toHaveAttribute(
      "href",
      "/posts",
    );
  });

  it("renders a useful empty state when there are no published posts", async () => {
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
  getPublishedTags.mockRejectedValueOnce(
    new Error("Public tags are temporarily unavailable."),
  );
  await expect(Home()).rejects.toThrow("temporarily unavailable");
  expect(getPublishedTags).toHaveBeenCalledWith({ limit: 12 });
});
