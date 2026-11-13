import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { resolveWebsiteTemplate } from "../registry";

import type { PublicPostSummary } from "@/lib/content/public-content.server";

const posts: PublicPostSummary[] = [
  "Newest story",
  "Second story",
  "Third story",
  "Fourth story",
  "Fifth story",
].map((title, index) => ({
  slug: `story-${index}`,
  title,
  summary: "A real summary",
  publishedAt: `2026-01-0${5 - index}T12:00:00Z`,
  cover: null,
  author: null,
  taxonomies: [],
}));

for (const preset of ["classic", "modern", "minimal"]) {
  for (const variant of ["default", "compact"] as const) {
    it(`${preset}/${variant} separates the chronological lead from supporting posts`, () => {
      const { Home } = resolveWebsiteTemplate("blog", preset).views;
      render(
        <Home
          siteName="Journal"
          siteDescription="About the journal"
          posts={posts.slice(0, 3)}
          listVariant={variant}
        />,
      );
      const lead = within(screen.getByRole("region", { name: "Latest post" }));
      const recent = within(
        screen.getByRole("region", { name: "Recent posts" }),
      );
      expect(lead.getByRole("link", { name: "Newest story" })).toHaveAttribute(
        "href",
        "/en/posts/story-0",
      );
      expect(
        recent.getAllByRole("heading").map((heading) => heading.textContent),
      ).toEqual(["Recent posts", "Second story", "Third story"]);
      expect(
        screen.getAllByRole("link", { name: "Newest story" }),
      ).toHaveLength(1);
      expect(screen.getByRole("link", { name: /All posts/ })).toHaveAttribute(
        "href",
        "/en/posts",
      );
    });
    it.each([2, 4, 5])(
      `${preset}/${variant} retains order with %i posts`,
      (count) => {
        const { Home } = resolveWebsiteTemplate("blog", preset).views;
        render(
          <Home
            siteName="Journal"
            siteDescription=""
            posts={posts.slice(0, count)}
            listVariant={variant}
          />,
        );
        expect(
          screen
            .getAllByRole("heading", { level: 3 })
            .map((heading) => heading.textContent),
        ).toEqual(posts.slice(0, count).map((post) => post.title));
        expect(
          within(
            screen.getByRole("region", { name: "Latest post" }),
          ).getAllByRole("link"),
        ).toHaveLength(1);
        expect(
          within(
            screen.getByRole("region", { name: "Recent posts" }),
          ).getAllByRole("link"),
        ).toHaveLength(count);
      },
    );
    it.each([0, 1])(
      `${preset}/${variant} supports %i posts with archive navigation and no fabricated supporting stories`,
      (count) => {
        const { Home } = resolveWebsiteTemplate("blog", preset).views;
        render(
          <Home
            siteName="Journal"
            siteDescription="   "
            posts={posts.slice(0, count)}
            listVariant={variant}
          />,
        );
        expect(
          screen.getByRole("region", { name: "Recent posts" }),
        ).toContainElement(screen.getByRole("link", { name: /All posts/ }));
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
          "Latest from the publication",
        );
        if (count === 0) {
          expect(
            screen.getByText("There are no published posts yet."),
          ).toBeVisible();
          expect(
            screen.queryByRole("region", { name: "Latest post" }),
          ).not.toBeInTheDocument();
        } else {
          expect(
            screen.getByRole("link", { name: "Newest story" }),
          ).toBeVisible();
        }
      },
    );
  }
}

it.each([
  "The Daily Journal",
  "NextPress",
  "\u00c1rv\u00edzt\u0171r\u0151 t\u00fck\u00f6rf\u00far\u00f3g\u00e9p",
])(
  "omits the redundant masthead for %s and retains a page heading",
  (siteName) => {
    const { Home } = resolveWebsiteTemplate("blog", "classic").views;
    render(
      <Home
        siteName={siteName}
        siteDescription={siteName}
        posts={posts}
        listVariant="default"
      />,
    );
    expect(screen.queryByText(siteName)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Latest from the publication",
    );
    expect(screen.getAllByRole("link")[0]).toHaveTextContent("Newest story");
  },
);

it("keeps the configured description out of the visual introduction", () => {
  const { Home } = resolveWebsiteTemplate("blog", "minimal").views;
  render(
    <Home
      siteName="Journal"
      siteDescription="Independent writing about everyday life."
      posts={posts}
      listVariant="default"
    />,
  );
  expect(
    screen.queryByText("Independent writing about everyday life."),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Journal")).not.toBeInTheDocument();
});
it("retains a long title without fabricated media or summaries", () => {
  const title =
    "A long editorial title about accessible publishing and maintaining clear content across changing screen sizes";
  const { Home } = resolveWebsiteTemplate("blog", "classic").views;
  render(
    <Home
      siteName="NextPress"
      siteDescription="NextPress admin"
      posts={[{ ...posts[0], title, summary: "", cover: null }]}
      listVariant="default"
    />,
  );
  expect(screen.getByRole("link", { name: title })).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.queryByText("NextPress admin")).not.toBeInTheDocument();
});
it("orders latest and recent post taxonomy after each available excerpt", () => {
  const { Home } = resolveWebsiteTemplate("blog", "classic").views;
  const category = {
    type: "CATEGORY" as const,
    slug: "design",
    name: "Design",
  };
  const tag = {
    type: "TAG" as const,
    slug: "accessibility",
    name: "Accessibility",
  };
  render(
    <Home
      siteName="Journal"
      siteDescription=""
      posts={[
        { ...posts[0], summary: "Lead excerpt.", taxonomies: [category, tag] },
        {
          ...posts[1],
          summary: "Recent excerpt.",
          taxonomies: [category, tag],
        },
        { ...posts[2], summary: "", taxonomies: [category, tag] },
      ]}
      listVariant="default"
    />,
  );
  const entries = screen.getAllByRole("article");
  const excerpts = ["Lead excerpt.", "Recent excerpt.", undefined];

  for (const [index, excerpt] of excerpts.entries()) {
    const entry = within(entries[index]);
    const title = entry.getByRole("heading");
    const date = entry.getByText(/2026/);
    const categoryLink = entry.getByRole("link", { name: category.name });
    const tagLink = entry.getByRole("link", { name: tag.name });

    expect(
      title.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    if (excerpt) {
      const summary = entry.getByText(excerpt);
      expect(
        date.compareDocumentPosition(summary) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        summary.compareDocumentPosition(categoryLink) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    } else {
      expect(
        date.compareDocumentPosition(categoryLink) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(
      categoryLink.compareDocumentPosition(tagLink) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(entry.getAllByRole("link", { name: category.name })).toHaveLength(1);
    expect(entry.getAllByRole("link", { name: tag.name })).toHaveLength(1);
  }
});
it("keeps shared tags after recent stories and the archive link", () => {
  const { Home } = resolveWebsiteTemplate("blog", "classic").views;
  const tag = {
    type: "TAG" as const,
    slug: "older-writing",
    name: "Tag from an older published article",
  };
  render(
    <Home
      siteName="NextPress"
      siteDescription=""
      posts={posts.map((post) => ({ ...post, taxonomies: [tag] }))}
      listVariant="default"
      tagBatch={{ tags: [tag, tag], hasMore: true }}
    />,
  );
  const recent = screen.getByRole("region", { name: "Recent posts" });
  const archiveLink = within(recent).getByRole("link", { name: /All posts/ });
  const tags = screen.getByRole("region", { name: "Tags" });
  expect(archiveLink).toHaveAttribute("href", "/en/posts");
  expect(
    archiveLink.compareDocumentPosition(tags) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getAllByRole("link", { name: tag.name })).toHaveLength(
    posts.length + 1,
  );
  expect(within(tags).getByRole("link", { name: tag.name })).toHaveAttribute(
    "href",
    "/en/tags/older-writing",
  );
  expect(within(tags).getByRole("link", { name: "All tags" })).toHaveAttribute(
    "href",
    "/en/tags",
  );
  expect(
    within(screen.getByRole("region", { name: "Latest post" })).getAllByText(
      "Tags:",
    ),
  ).toHaveLength(1);
});
it("omits the Tags section when the public collection is empty", () => {
  const { Home } = resolveWebsiteTemplate("blog", "minimal").views;
  render(
    <Home
      siteName="NextPress"
      siteDescription=""
      posts={posts}
      listVariant="compact"
      tagBatch={{ tags: [], hasMore: false }}
    />,
  );
  expect(
    screen.queryByRole("region", { name: "Tags" }),
  ).not.toBeInTheDocument();
});
