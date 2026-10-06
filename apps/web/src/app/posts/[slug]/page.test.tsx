import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublishedPost, notFound } = vi.hoisted(() => ({
  getPublishedPost: vi.fn(),
  notFound: vi.fn(() => { throw new Error("not-found"); }),
}));

vi.mock("@/lib/content/public-content.server", () => ({ getPublishedPost }));
vi.mock("next/navigation", () => ({ notFound }));

import PostPage, { generateMetadata } from "./page";

const post = {
  slug: "first-story", title: "A first story", summary: "A useful introduction.",
  content: { version: 1 as const, blocks: [{ type: "paragraph" as const, children: [{ text: "The article body." }] }] },
  publishedAt: "2025-02-03T00:00:00.000Z", author: { name: "Ada Writer" },
  taxonomies: [{ type: "CATEGORY" as const, slug: "essays", name: "Essays" }], cover: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getPublishedPost.mockResolvedValue(post);
});

describe("Public post detail", () => {
  it("renders the article with publication details, safe rich content, and archive navigation", async () => {
    render(await PostPage({ params: Promise.resolve({ slug: "first-story" }) }));

    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "A first story" })).toBeInTheDocument();
    expect(screen.getByText("The article body.")).toBeInTheDocument();
    expect(screen.getByText("By Ada Writer")).toBeInTheDocument();
    expect(screen.getByText("Essays")).toBeInTheDocument();
    expect(screen.getByRole("time")).toHaveAttribute("dateTime", post.publishedAt);
    expect(screen.getByRole("link", { name: "All posts" })).toHaveAttribute("href", "/posts");
  });

  it("renders without optional author, category, summary, or cover data", async () => {
    getPublishedPost.mockResolvedValue({ ...post, author: null, taxonomies: [], summary: "", cover: null });
    render(await PostPage({ params: Promise.resolve({ slug: "first-story" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "A first story" })).toBeInTheDocument();
    expect(screen.getByText("The article body.")).toBeInTheDocument();
    expect(screen.queryByText(/By /)).not.toBeInTheDocument();
  });

  it("uses the same unavailable response for missing or non-public posts", async () => {
    getPublishedPost.mockResolvedValue(null);
    await expect(PostPage({ params: Promise.resolve({ slug: "unavailable" }) })).rejects.toThrow("not-found");
    expect(notFound).toHaveBeenCalled();
  });

  it("generates basic title and summary metadata only for available posts", async () => {
    await expect(generateMetadata({ params: Promise.resolve({ slug: "first-story" }) })).resolves.toEqual({
      title: "A first story", description: "A useful introduction.",
    });
    getPublishedPost.mockResolvedValue(null);
    await expect(generateMetadata({ params: Promise.resolve({ slug: "missing" }) })).resolves.toEqual({});
  });
});
