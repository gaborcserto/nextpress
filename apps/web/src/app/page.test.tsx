import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { getPublishedPosts, getPublicSiteSettings } = vi.hoisted(() => ({
  getPublishedPosts: vi.fn(),
  getPublicSiteSettings: vi.fn(),
}));

vi.mock("@/lib/content/public-content.server", () => ({ getPublishedPosts }));
vi.mock("@/lib/settings/public-site-settings.server", () => ({ getPublicSiteSettings }));

import Home from "./page";

describe("Home", () => {
  it("renders the configured publication and latest published post summaries", async () => {
    getPublicSiteSettings.mockResolvedValue({ siteName: "Field Notes", siteDescription: "Stories from the field." });
    getPublishedPosts.mockResolvedValue({ posts: [{
      slug: "first-story", title: "A first story", summary: "A useful introduction.",
      publishedAt: "2025-02-03T00:00:00.000Z", author: { name: "A. Writer" },
      taxonomies: [{ type: "CATEGORY", slug: "essays", name: "Essays" }],
    }], hasMore: false });

    render(await Home());

    expect(screen.getByRole("heading", { level: 1, name: "Field Notes" })).toBeInTheDocument();
    expect(screen.getByText("Stories from the field.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Latest posts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A first story" })).toHaveAttribute("href", "/posts/first-story");
    expect(screen.getByText("A useful introduction.")).toBeInTheDocument();
    expect(screen.getByText("By A. Writer")).toBeInTheDocument();
    expect(screen.getByText("Essays")).toBeInTheDocument();
    expect(screen.getByText("February 3, 2025")).toHaveAttribute("datetime", "2025-02-03T00:00:00.000Z");
    expect(screen.getByRole("link", { name: "All posts" })).toHaveAttribute("href", "/posts");
  });

  it("renders a useful empty state when there are no published posts", async () => {
    getPublicSiteSettings.mockResolvedValue({ siteName: "Field Notes", siteDescription: "Stories from the field." });
    getPublishedPosts.mockResolvedValue({ posts: [], hasMore: false });

    render(await Home());

    expect(screen.getByText("There are no published posts yet.")).toBeInTheDocument();
  });
});
