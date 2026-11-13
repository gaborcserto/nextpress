import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { BlogPostFooter } from "./BlogPostFooter";

import type {
  PublicContent,
  PublicPostSummary,
} from "@/lib/content/public-content.server";

const post: PublicContent = {
  slug: "current",
  title: "Current",
  summary: "",
  content: { version: 1, blocks: [] },
  publishedAt: "2026-01-01T00:00:00Z",
  author: null,
  cover: null,
  taxonomies: [],
};
const category = {
  type: "CATEGORY" as const,
  slug: "design",
  name: "Árvíztűrő tervezés",
};
const tag = {
  type: "TAG" as const,
  slug: "long",
  name: "A very long taxonomy label about accessible publishing and editorial typography",
};

it.each([
  [[], false, false],
  [[category], true, false],
  [[tag], false, true],
  [[tag, category, tag, category], true, true],
] as const)(
  "groups and deduplicates real assignments %j",
  (taxonomies, hasCategories, hasTags) => {
    render(
      <BlogPostFooter
        post={{ ...post, taxonomies: [...taxonomies] }}
        additionalPosts={[]}
      />,
    );
    expect(screen.queryByText("Categories:") !== null).toBe(hasCategories);
    expect(screen.queryByText("Tags:") !== null).toBe(hasTags);
    if (hasCategories) {
      expect(screen.getAllByText(category.name)).toHaveLength(1);
    }
    if (hasTags) {
      expect(screen.getAllByText(tag.name)).toHaveLength(1);
    }
    expect(screen.queryAllByRole("link")).toHaveLength(
      Number(hasCategories) + Number(hasTags),
    );
  },
);

it.each([0, 1, 6])(
  "shows at most four other articles from %i records",
  (count) => {
    const posts: PublicPostSummary[] = Array.from(
      { length: count },
      (_, index) => ({
        ...post,
        slug: `story-${index}`,
        title: `Story ${index}`,
        publishedAt: `2026-01-0${index + 1}T00:00:00Z`,
      }),
    );
    render(
      <BlogPostFooter
        post={post}
        additionalPosts={[post, ...posts, ...posts]}
      />,
    );
    if (count === 0) {
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
      expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();

      return;
    }
    const section = within(
      screen.getByRole("region", { name: "More articles" }),
    );
    const links = section.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(
      [...posts]
        .reverse()
        .slice(0, 4)
        .map(({ title }) => title),
    );
    expect(links[0]).toHaveAttribute("href", `/en/posts/story-${count - 1}`);
    expect(
      screen.queryByRole("link", { name: "Current" }),
    ).not.toBeInTheDocument();
  },
);
it("includes compact taxonomy links beneath additional article titles", () => {
  render(
    <BlogPostFooter
      post={post}
      additionalPosts={[
        {
          ...post,
          slug: "other",
          title: "Another article",
          taxonomies: [category, tag],
        },
      ]}
    />,
  );
  const section = within(screen.getByRole("region", { name: "More articles" }));
  expect(section.getByRole("link", { name: category.name })).toHaveAttribute(
    "href",
    "/en/categories/design",
  );
  expect(section.getByRole("link", { name: tag.name })).toHaveAttribute(
    "href",
    "/en/tags/long",
  );
});
