import { PublicPostBatchSchema } from "@nextpress/shared/api-contracts";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { resolvePostListTemplate } from "./templates";

const posts = PublicPostBatchSchema.parse({
  posts: [
    {
      slug: "hello",
      title: "Hello",
      summary: "Preview text",
      publishedAt: "2025-01-01T00:00:00Z",
      author: null,
      taxonomies: [],
    },
  ],
  hasMore: false,
}).posts;

it.each([undefined, "invalid", "../../code", {}, ["compact"]])(
  "falls back to the default template for %j",
  (id) => {
    expect(resolvePostListTemplate(id).id).toBe("default");
  },
);
it.each(["default", "compact"])(
  "renders portable DTOs with accessible links in %s",
  (id) => {
    const Template = resolvePostListTemplate(id).render;
    render(<Template posts={posts} />);
    expect(screen.getByRole("link", { name: "Hello" })).toHaveAttribute(
      "href",
      "/en/posts/hello",
    );
    if (id === "compact")
      expect(screen.queryByText("Preview text")).not.toBeInTheDocument();
    else expect(screen.getByText("Preview text")).toBeInTheDocument();
  },
);
it.each(["default", "compact"])("preserves empty state in %s", (id) => {
  const Template = resolvePostListTemplate(id).render;
  render(<Template posts={[]} />);
  expect(
    screen.getByText("There are no published posts yet."),
  ).toBeInTheDocument();
});
