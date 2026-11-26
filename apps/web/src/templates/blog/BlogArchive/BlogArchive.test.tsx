import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { BlogArchive } from "./BlogArchive";

const post = {
  slug: "story",
  title: "Story",
  summary: "",
  publishedAt: "2026-01-01T12:00:00Z",
  author: null,
  taxonomies: [],
};

for (const listingMode of ["PAGINATION", "LOAD_MORE"] as const) {
  it.each([
    { name: "empty", posts: [], page: 1, hasMore: false, visible: false },
    {
      name: "single page",
      posts: [post],
      page: 1,
      hasMore: false,
      visible: false,
    },
    {
      name: "first of multiple pages, even with a short batch",
      posts: [post],
      page: 1,
      hasMore: true,
      visible: true,
    },
    {
      name: "middle page",
      posts: [post],
      page: 2,
      hasMore: true,
      visible: true,
    },
    {
      name: "last page",
      posts: [post],
      page: 3,
      hasMore: false,
      visible: true,
    },
  ])(
    `${listingMode}: $name uses pagination metadata`,
    ({ posts, page, hasMore, visible }) => {
      render(
        <BlogArchive
          posts={posts}
          page={page}
          hasMore={hasMore}
          postsPerPage={10}
          listingMode={listingMode}
          listVariant="default"
        />,
      );
      const navigation = screen.queryByRole("navigation", {
        name: "Post archive pages",
      });

      if (!visible) {
        expect(navigation).not.toBeInTheDocument();
        expect(screen.queryByText("1")).not.toBeInTheDocument();

        return;
      }

      expect(navigation).toBeInTheDocument();
      const controls = within(
        screen.getByRole("navigation", { name: "Post archive pages" }),
      );
      expect(controls.getByText(String(page))).toHaveAttribute(
        "aria-current",
        "page",
      );

      if (page > 1) {
        expect(
          controls.getByRole("link", { name: "Previous page" }),
        ).toHaveAttribute(
          "href",
          page === 2 ? "/en/posts" : `/en/posts?page=${page - 1}`,
        );
      } else {
        expect(
          controls.queryByRole("link", { name: "Previous page" }),
        ).not.toBeInTheDocument();
      }

      if (hasMore && listingMode === "LOAD_MORE") {
        expect(
          controls.getByRole("button", { name: "Load more posts" }),
        ).toBeVisible();
      } else if (hasMore) {
        expect(
          controls.getByRole("link", { name: "Next page" }),
        ).toHaveAttribute("href", `/en/posts?page=${page + 1}`);
      } else {
        expect(
          controls.queryByRole("link", { name: "Next page" }),
        ).not.toBeInTheDocument();
        expect(controls.queryByRole("button")).not.toBeInTheDocument();
      }
    },
  );
}

for (const listVariant of ["default", "compact"] as const) {
  it.each([0, 1, 2])(
    `${listVariant}: %i posts retain the archive heading without a repeated label`,
    (count) => {
      const posts = Array.from({ length: count }, (_, index) => ({
        ...post,
        slug: `story-${index}`,
        title: `Story ${index}`,
      }));
      render(
        <BlogArchive
          posts={posts}
          page={1}
          hasMore={false}
          postsPerPage={10}
          listingMode="PAGINATION"
          listVariant={listVariant}
        />,
      );
      expect(
        screen.getByRole("heading", { level: 1, name: "Posts" }),
      ).toBeVisible();
      expect(
        screen.getByRole("region", { name: "Published articles" }),
      ).toHaveAttribute("data-blog-posts-archive");
      expect(screen.queryByText("Recent posts")).not.toBeInTheDocument();
      expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(
        count,
      );
      expect(
        screen.queryByRole("navigation", { name: "Post archive pages" }),
      ).not.toBeInTheDocument();
    },
  );
}
