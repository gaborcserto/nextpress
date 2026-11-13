import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import postStyles from "@/components/ContentArticlePost.module.css";

import { BlogPost } from "./BlogPost";

const post = {
  slug: "story",
  title: "Story",
  summary: "Introduction",
  publishedAt: "2026-01-01T00:00:00Z",
  author: null,
  taxonomies: [],
  content: {
    version: 1 as const,
    blocks: [
      { type: "paragraph" as const, children: [{ text: "Article body" }] },
    ],
  },
  cover: { url: "/media/sample", alt: "Landscape", width: 960, height: 640 },
};

it("matches the homepage All posts link with its shared arrow", () => {
  render(<BlogPost content={post} />);

  const link = screen.getByRole("link", { name: "All posts" });

  expect(link).toHaveAttribute("href", "/en/posts");
  expect(link.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
});

it("places the article cover before the reading content", () => {
  render(<BlogPost content={post} />);
  expect(screen.getByText("Article body").parentElement).toHaveClass(
    postStyles.content,
  );
  expect(
    screen
      .getByRole("img", { name: "Landscape" })
      .compareDocumentPosition(screen.getByText("Article body")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
it("avoids a duplicate cover already authored in a PageDocument hero", () => {
  render(
    <BlogPost
      content={{
        ...post,
        pageDocument: {
          version: 1,
          blocks: [
            {
              id: "hero",
              version: 1,
              type: "hero",
              props: { title: "Hero", description: "", mediaId: "sample" },
            },
          ],
        },
      }}
    />,
  );
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
it("places assigned taxonomy links after authored article content", () => {
  render(
    <BlogPost
      content={{
        ...post,
        taxonomies: [{ type: "TAG", slug: "news", name: "News" }],
      }}
    >
      <p>Authored page document</p>
    </BlogPost>,
  );
  const link = screen.getByRole("link", { name: "News" });
  expect(link).toHaveAttribute("href", "/en/tags/news");
  expect(
    screen.getByText("Authored page document").compareDocumentPosition(link) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
