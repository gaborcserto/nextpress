import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getNextPostBatch } = vi.hoisted(() => ({ getNextPostBatch: vi.fn() }));
vi.mock("@/app/posts/actions", () => ({ getNextPostBatch }));

import { LoadMorePostList } from "./LoadMorePostList";

const firstPost = {
  slug: "first", title: "First post", summary: "First summary",
  publishedAt: "2026-01-01T00:00:00.000Z", author: null, taxonomies: [],
};
const secondPost = {
  slug: "second", title: "Second post", summary: "Second summary",
  publishedAt: "2026-01-02T00:00:00.000Z", author: null, taxonomies: [],
};

beforeEach(() => vi.clearAllMocks());

describe("LoadMorePostList", () => {
  it("server-renders its initial content and a working page link fallback", () => {
    const html = renderToStaticMarkup(
      <LoadMorePostList posts={[firstPost]} page={1} hasMore postsPerPage={10} />,
    );

    expect(html).toContain("First post");
    expect(html).toContain('href="/posts?page=2"');
    expect(html).toContain("Next page");
  });

  it("appends only the next server batch and stops when it is final", async () => {
    getNextPostBatch.mockResolvedValueOnce({ posts: [secondPost], hasMore: false });
    render(<LoadMorePostList posts={[firstPost]} page={1} hasMore postsPerPage={10} />);

    fireEvent.click(await screen.findByRole("button", { name: "Load more posts" }));

    expect(await screen.findByRole("link", { name: "Second post" })).toHaveAttribute("href", "/posts/second");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Load more posts" })).not.toBeInTheDocument());
    expect(screen.getByText("Loaded 1 more post. Page 2.")).toHaveAttribute("role", "status");
    expect(getNextPostBatch).toHaveBeenCalledWith(2);
    expect(window.location.search).toBe("?page=2");
  });

  it("exposes the pending request state while loading the next page", async () => {
    let resolveBatch: (batch: { posts: typeof secondPost[]; hasMore: boolean }) => void = () => {};
    getNextPostBatch.mockReturnValueOnce(new Promise((resolve) => { resolveBatch = resolve; }));
    render(<LoadMorePostList posts={[firstPost]} page={1} hasMore postsPerPage={10} />);

    fireEvent.click(await screen.findByRole("button", { name: "Load more posts" }));

    const loadingButton = screen.getByRole("button", { name: "Loading posts…" });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveAttribute("aria-busy", "true");
    expect(getNextPostBatch).toHaveBeenCalledTimes(1);
    expect(getNextPostBatch).toHaveBeenCalledWith(2);

    await act(async () => resolveBatch({ posts: [secondPost], hasMore: false }));
    expect(await screen.findByRole("link", { name: "Second post" })).toBeInTheDocument();
  });

  it("keeps the bounded control available and reports recoverable action errors", async () => {
    getNextPostBatch.mockRejectedValueOnce(new Error("private failure"));
    render(<LoadMorePostList posts={[firstPost]} page={1} hasMore postsPerPage={10} />);

    fireEvent.click(await screen.findByRole("button", { name: "Load more posts" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load more posts. Please try again.");
    expect(screen.getByRole("button", { name: "Load more posts" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "First post" })).toHaveAttribute("href", "/posts/first");

    getNextPostBatch.mockResolvedValueOnce({ posts: [secondPost], hasMore: false });
    fireEvent.click(screen.getByRole("button", { name: "Load more posts" }));
    expect(await screen.findByRole("link", { name: "Second post" })).toHaveAttribute("href", "/posts/second");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
