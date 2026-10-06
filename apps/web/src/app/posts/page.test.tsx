import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublishedPosts, redirect } = vi.hoisted(() => ({
  getPublishedPosts: vi.fn(),
  redirect: vi.fn((href: string) => { throw new Error(`redirect:${href}`); }),
}));

vi.mock("@/lib/content/public-content.server", () => ({ getPublishedPosts }));
vi.mock("next/navigation", () => ({ redirect }));

import PostsPage from "./page";

const post = {
  slug: "first-story", title: "A first story", summary: "A useful introduction.",
  publishedAt: "2025-02-03T00:00:00.000Z", author: null, taxonomies: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  getPublishedPosts.mockResolvedValue({ posts: [post], hasMore: false });
});

describe("Posts archive", () => {
  it("renders the first page and a next link when more posts exist", async () => {
    getPublishedPosts.mockResolvedValue({ posts: [post], hasMore: true });

    render(await PostsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { level: 1, name: "Posts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A first story" })).toHaveAttribute("href", "/posts/first-story");
    expect(screen.getByRole("navigation", { name: "Post archive pages" })).toBeInTheDocument();
    expect(screen.getByText("1")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/posts?page=2");
    expect(screen.queryByRole("link", { name: "Previous page" })).not.toBeInTheDocument();
    expect(getPublishedPosts).toHaveBeenCalledWith({ limit: 10, offset: 0 });
  });

  it("renders both navigation links for a middle page", async () => {
    getPublishedPosts.mockResolvedValue({ posts: [post], hasMore: true });

    render(await PostsPage({ searchParams: Promise.resolve({ page: "2" }) }));

    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/posts");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/posts?page=3");
    expect(screen.getByText("2")).toHaveAttribute("aria-current", "page");
    expect(getPublishedPosts).toHaveBeenCalledWith({ limit: 10, offset: 10 });
  });

  it("omits next navigation on the final page", async () => {
    render(await PostsPage({ searchParams: Promise.resolve({ page: "3" }) }));

    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/posts?page=2");
    expect(screen.queryByRole("link", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("shows the intentional empty state for an empty archive", async () => {
    getPublishedPosts.mockResolvedValue({ posts: [], hasMore: false });

    render(await PostsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("There are no published posts yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Previous page" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("normalizes invalid pages and returns to the archive root for an out-of-range page", async () => {
    render(await PostsPage({ searchParams: Promise.resolve({ page: "nope" }) }));
    expect(getPublishedPosts).toHaveBeenCalledWith({ limit: 10, offset: 0 });

    getPublishedPosts.mockResolvedValue({ posts: [], hasMore: false });
    await expect(PostsPage({ searchParams: Promise.resolve({ page: "9" }) })).rejects.toThrow("redirect:/posts");
    expect(redirect).toHaveBeenCalledWith("/posts");
  });
});
