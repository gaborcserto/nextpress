import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { getPublicPageNavigation, getPublicSiteSettings } = vi.hoisted(() => ({
  getPublicPageNavigation: vi.fn(),
  getPublicSiteSettings: vi.fn(),
}));

vi.mock("@/lib/content/public-content.server", () => ({
  getPublicPageNavigation,
}));
vi.mock("@/lib/settings/public-site-settings.server", () => ({
  getPublicSiteSettings,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { PublicWebsiteShell } from "./PublicWebsiteShell";

beforeEach(() => {
  vi.clearAllMocks();
  getPublicPageNavigation.mockResolvedValue({
    header: [{ slug: "about", title: "About" }],
    footer: [{ slug: "contact", title: "Contact" }],
  });
  getPublicSiteSettings.mockResolvedValue({
    siteName: "Example Publication",
    appearance: {
      websiteTemplate: "blog",
      stylePreset: "classic",
    },
  });
});

it("keeps the configured header and footer around normal page content", async () => {
  render(await PublicWebsiteShell({ children: <p>Normal page</p> }));

  expect(
    screen.getByRole("link", { name: "Example Publication" }),
  ).toHaveAttribute("href", "/en/");
  expect(screen.getByRole("banner")).toBeInTheDocument();
  expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  expect(
    within(screen.getByRole("navigation", { name: "Primary" })).getByRole(
      "link",
      { name: "About" },
    ),
  ).toHaveAttribute("href", "/en/pages/about");
  expect(
    within(screen.getByRole("navigation", { name: "Footer" })).getByRole(
      "link",
      { name: "Contact" },
    ),
  ).toHaveAttribute("href", "/en/pages/contact");
  expect(screen.getByText("Normal page")).toBeInTheDocument();
});
