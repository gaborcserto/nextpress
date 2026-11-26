import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/i18n/server", () => ({ getLocale: async () => "en" }));

import { BlogSearch } from "./BlogSearch";

const query = {
  q: "react",
  type: "all" as const,
  sort: "relevance" as const,
  page: 2,
  category: "news",
  tag: "react",
};

it("renders real post/page links, metadata and preserves filters in pagination", async () => {
  const item = {
    title: "React article",
    slug: "react",
    summary: "Summary",
    publishedAt: "2025-01-01T00:00:00.000Z",
    author: null,
    cover: null,
    taxonomies: [],
  };
  render(
    await BlogSearch({
      query,
      data: {
        total: 25,
        taxonomies: [],
        results: [
          { ...item, type: "POST" },
          { ...item, slug: "about", type: "PAGE", title: "About" },
        ],
      },
    }),
  );
  expect(screen.getByRole("link", { name: "React article" })).toHaveAttribute(
    "href",
    "/en/posts/react",
  );
  expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
    "href",
    "/en/pages/about",
  );
  const next = screen.getByRole("link", { name: "Next page" });
  expect(next.getAttribute("href")).toContain("page=3");
  expect(next.getAttribute("href")).toContain("category=news");
  expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue(
    "react",
  );
});

it("distinguishes empty input and no matching results", async () => {
  const data = { total: 0, results: [], taxonomies: [] };
  const { unmount } = render(
    await BlogSearch({ query: { ...query, q: "" }, data }),
  );
  expect(
    screen.getByText("Enter a search term to find articles and pages."),
  ).toBeInTheDocument();
  unmount();
  render(await BlogSearch({ query, data }));
  expect(screen.getByText("No matching results.")).toBeInTheDocument();
});
