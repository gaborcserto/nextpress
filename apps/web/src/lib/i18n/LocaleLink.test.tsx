import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { LocaleLink, LocaleProvider } from "./client";
it("keeps UI navigation in the URL locale while preserving explicit destinations and assets", () => {
  render(
    <LocaleProvider locale="hu">
      <LocaleLink href="/posts/story?page=2#article">Story</LocaleLink>
      <LocaleLink href="/en/posts/story">English story</LocaleLink>
      <LocaleLink href="/media/image">Image</LocaleLink>
      <LocaleLink
        href={{ pathname: "/search", query: { q: "story", page: 2 } }}
      >
        Search
      </LocaleLink>
    </LocaleProvider>,
  );
  expect(screen.getByRole("link", { name: "Story" })).toHaveAttribute(
    "href",
    "/hu/posts/story?page=2#article",
  );
  expect(screen.getByRole("link", { name: "English story" })).toHaveAttribute(
    "href",
    "/en/posts/story",
  );
  expect(screen.getByRole("link", { name: "Image" })).toHaveAttribute(
    "href",
    "/media/image",
  );
  expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
    "href",
    "/hu/search?q=story&page=2",
  );
});

it("uses a document navigation when an explicit destination changes the root locale", () => {
  render(
    <LocaleProvider locale="hu">
      <LocaleLink href="/en/posts">English archive</LocaleLink>
    </LocaleProvider>,
  );
  const link = screen.getByRole("link", { name: "English archive" });
  expect(fireEvent.click(link)).toBe(false);
});
