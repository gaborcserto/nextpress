import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublishedPage, notFound } = vi.hoisted(() => ({
  getPublishedPage: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("@/lib/content/public-content.server", () => ({ getPublishedPage }));
vi.mock("@/lib/settings/public-site-settings.server", () => ({
  getPublicSiteSettings: vi.fn().mockResolvedValue({
    appearance: {
      websiteTemplate: "blog",
      stylePreset: "classic",
      colorMode: "dark",
    },
  }),
}));
vi.mock("@/components/public-shell/PublicWebsiteShell", () => ({
  PublicWebsiteShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({ notFound }));

import StaticPage, { generateMetadata } from "./page";

import type { ReactNode } from "react";

const page = {
  slug: "about",
  title: "About us",
  summary: "A short introduction.",
  content: {
    version: 1 as const,
    blocks: [
      { type: "paragraph" as const, children: [{ text: "Page body." }] },
    ],
  },
  publishedAt: "2025-02-03T00:00:00.000Z",
  author: null,
  taxonomies: [],
  cover: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getPublishedPage.mockResolvedValue(page);
});

describe("Public static page", () => {
  it("renders a titled semantic page with safe rich content", async () => {
    render(await StaticPage({ params: Promise.resolve({ slug: "about" }) }));
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "About us" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Page body.")).toBeInTheDocument();
  });

  it("uses a shared unavailable response for missing and non-public pages", async () => {
    getPublishedPage.mockResolvedValue(null);
    await expect(
      StaticPage({ params: Promise.resolve({ slug: "unavailable" }) }),
    ).rejects.toThrow("not-found");
    expect(notFound).toHaveBeenCalled();
  });

  it("generates basic metadata from existing page fields", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "about" }) }),
    ).resolves.toEqual({
      title: "About us",
      description: "A short introduction.",
      alternates: { canonical: new URL("http://localhost:49100/pages/about") },
      openGraph: {
        title: "About us",
        description: "A short introduction.",
        type: "website",
        url: new URL("http://localhost:49100/pages/about"),
      },
    });
    getPublishedPage.mockResolvedValue({ ...page, summary: "" });
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "about" }) }),
    ).resolves.toEqual({
      title: "About us",
      alternates: { canonical: new URL("http://localhost:49100/pages/about") },
      openGraph: {
        title: "About us",
        type: "website",
        url: new URL("http://localhost:49100/pages/about"),
      },
    });
  });
});
