import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublicSiteSettings, getPublicPageNavigation } = vi.hoisted(() => ({ getPublicSiteSettings: vi.fn(), getPublicPageNavigation: vi.fn() }));
vi.mock("@/lib/settings/public-site-settings.server", () => ({ getPublicSiteSettings }));
vi.mock("@/lib/content/public-content.server", () => ({ getPublicPageNavigation }));
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist-sans" }),
  Geist_Mono: () => ({ variable: "geist-mono" }),
}));

import RootLayout, { generateMetadata } from "./layout";

beforeEach(() => {
  vi.resetAllMocks();
  getPublicSiteSettings.mockResolvedValue({
    siteName: "Example Publication",
    siteDescription: "Independent reporting.",
  });
  getPublicPageNavigation.mockResolvedValue({
    header: [{ slug: "about", title: "About" }],
    footer: [{ slug: "contact", title: "Contact" }],
  });
});

describe("public layout settings integration", () => {
  it("renders the configured identity in the shell around page content", async () => {
    render(await RootLayout({ children: <p>Page content</p> }), {
      container: document,
    });

    expect(screen.getByRole("link", { name: "Example Publication" })).toHaveAttribute("href", "/");
    expect(within(screen.getByRole("contentinfo")).getByText("Example Publication")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByText("Page content")).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Primary" })).getByRole("link", { name: "About" }))
      .toHaveAttribute("href", "/pages/about");
    expect(within(screen.getByRole("navigation", { name: "Footer" })).getByRole("link", { name: "Contact" }))
      .toHaveAttribute("href", "/pages/contact");
  });

  it("uses the same public identity for the existing title and description metadata", async () => {
    expect(await generateMetadata()).toEqual({
      title: "Example Publication",
      description: "Independent reporting.",
    });
  });
});
