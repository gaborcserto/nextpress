import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { read, redirect } = vi.hoisted(() => ({
  read: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("@/lib/content/public-content.server", () => ({
  getPublishedTags: read,
}));
vi.mock("@/lib/settings/public-site-settings.server", () => ({
  getPublicSiteSettings: async () => ({
    appearance: {
      websiteTemplate: "blog",
      stylePreset: "classic",
      colorMode: "light",
    },
  }),
}));
vi.mock("@/components/public-shell/PublicWebsiteShell", () => ({
  PublicWebsiteShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({ redirect }));

import TagsPage, { generateMetadata } from "./page";

import type { ReactNode } from "react";

const tag = {
  type: "TAG",
  slug: "outside-the-homepage",
  name: "A public tag from an older post",
};
beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue({ tags: [tag], hasMore: true });
});

it("renders the public tag index with scoped pagination and working archive links", async () => {
  render(await TagsPage({ searchParams: Promise.resolve({ page: "2" }) }));
  expect(screen.getByRole("heading", { level: 1, name: "Tags" })).toBeVisible();
  expect(screen.getByRole("link", { name: tag.name })).toHaveAttribute(
    "href",
    "/tags/outside-the-homepage",
  );
  const navigation = within(
    screen.getByRole("navigation", { name: "Tag index pages" }),
  );
  expect(
    navigation.getByRole("link", { name: "Previous page" }),
  ).toHaveAttribute("href", "/tags");
  expect(navigation.getByRole("link", { name: "Next page" })).toHaveAttribute(
    "href",
    "/tags?page=3",
  );
  expect(read).toHaveBeenCalledWith({ limit: 30, offset: 30 });
  const metadata = await generateMetadata({
    searchParams: Promise.resolve({ page: "2" }),
  });
  expect(metadata.alternates?.canonical?.toString()).toBe(
    "http://localhost:49100/tags?page=2",
  );
});
it("shows a real empty state without pagination", async () => {
  read.mockResolvedValue({ tags: [], hasMore: false });
  render(await TagsPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("There are no published tags yet.")).toBeVisible();
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});
it("handles invalid pages, exhausted pages and upstream failures", async () => {
  render(await TagsPage({ searchParams: Promise.resolve({ page: "bad" }) }));
  expect(read).toHaveBeenCalledWith({ limit: 30, offset: 0 });
  read.mockResolvedValueOnce({ tags: [], hasMore: false });
  await expect(
    TagsPage({ searchParams: Promise.resolve({ page: "3" }) }),
  ).rejects.toThrow("redirect:/tags");
  read.mockRejectedValueOnce(
    new Error("Public content is temporarily unavailable."),
  );
  await expect(TagsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    "temporarily unavailable",
  );
});
