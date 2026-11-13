import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { CompactPostList } from "./CompactPostList";
import { DefaultPostList } from "./DefaultPostList";
import { PostTaxonomies } from "./PostTaxonomies";
import { TagLinks } from "./TagLinks";

const category = { type: "CATEGORY" as const, slug: "design", name: "Design" };
const tag = {
  type: "TAG" as const,
  slug: "accessibility",
  name: "A long accented taxonomy name: \u00c1rv\u00edzt\u0171r\u0151 t\u00fck\u00f6rf\u00far\u00f3g\u00e9p",
};
it.each([
  { taxonomies: [category] },
  { taxonomies: [tag] },
  { taxonomies: [category, tag, category] },
  { taxonomies: [] },
])("renders only assigned deduplicated taxonomy links %j", ({ taxonomies }) => {
  render(<PostTaxonomies taxonomies={taxonomies} />);
  expect(screen.queryAllByRole("link")).toHaveLength(
    new Set(taxonomies.map((item) => item.slug)).size,
  );
  if (taxonomies.includes(category)) {
    expect(screen.getByRole("link", { name: category.name })).toHaveAttribute(
      "href",
      "/categories/design",
    );
  }
  if (taxonomies.includes(tag)) {
    expect(screen.getByRole("link", { name: tag.name })).toHaveAttribute(
      "href",
      "/tags/accessibility",
    );
  }
});
it("omits invalid slugs and empty labels without broken destinations", () => {
  render(
    <PostTaxonomies
      taxonomies={[
        { ...tag, slug: "../bad" },
        { ...category, name: " " },
      ]}
    />,
  );
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.queryByText("Tags:")).not.toBeInTheDocument();
});
it.each([DefaultPostList, CompactPostList])(
  "includes categories and tags in each list variant",
  (List) => {
    render(
      <List
        posts={[
          {
            slug: "story",
            title: "Story",
            summary: "",
            publishedAt: "2025-01-01T00:00:00Z",
            author: null,
            cover: null,
            taxonomies: [category, tag],
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: category.name })).toHaveAttribute(
      "href",
      "/categories/design",
    );
    expect(screen.getByRole("link", { name: tag.name })).toHaveAttribute(
      "href",
      "/tags/accessibility",
    );
  },
);

it("places taxonomy after the excerpt in default post entries", () => {
  render(
    <DefaultPostList
      posts={[
        {
          slug: "story",
          title: "Story",
          summary: "A short excerpt.",
          publishedAt: "2025-01-01T00:00:00Z",
          author: null,
          cover: null,
          taxonomies: [category, tag],
        },
      ]}
    />,
  );
  const title = screen.getByRole("heading", { name: "Story" });
  const date = screen.getByText("January 1, 2025");
  const summary = screen.getByText("A short excerpt.");
  const categoryLink = screen.getByRole("link", { name: category.name });
  const tagLink = screen.getByRole("link", { name: tag.name });

  expect(
    title.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    date.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    summary.compareDocumentPosition(categoryLink) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    categoryLink.compareDocumentPosition(tagLink) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("shares the same taxonomy link interaction class in assignment and tag lists", () => {
  const { container: assignments } = render(
    <PostTaxonomies taxonomies={[tag]} />,
  );
  const assignmentLink = assignments.querySelector("a");
  const { container: tags } = render(<TagLinks tags={[tag]} />);
  const tagLink = tags.querySelector("a");

  expect(assignmentLink).toHaveClass(tagLink?.className ?? "");
});
