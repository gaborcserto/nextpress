import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { fetchPublic, getPublicSiteSettings } = vi.hoisted(() => ({
  fetchPublic: vi.fn(),
  getPublicSiteSettings: vi.fn(),
}));

vi.mock("@/lib/content/public-api.server", () => ({
  fetchPublic,
}));
vi.mock("@/lib/settings/public-site-settings.server", () => ({
  getPublicSiteSettings,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

import { PublicWebsiteShell } from "./PublicWebsiteShell";

beforeEach(() => {
  vi.clearAllMocks();
  fetchPublic.mockResolvedValue({
    header: [{ href: "/about", label: "About", parent: null, newTab: false }],
    footer: [
      { href: "/contact", label: "Contact", parent: null, newTab: false },
    ],
    sidebar: [{ href: "/help", label: "Help", parent: null, newTab: false }],
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
  ).toHaveAttribute("href", "/en/about");
  expect(
    within(screen.getByRole("navigation", { name: "Footer" })).getByRole(
      "link",
      { name: "Contact" },
    ),
  ).toHaveAttribute("href", "/en/contact");
  expect(screen.getByText("Normal page")).toBeInTheDocument();
});

it.each([
  { preset: "classic", visible: false },
  { preset: "modern", visible: false },
  { preset: "minimal", visible: true },
])(
  "uses the $preset template sidebar capability",
  async ({ preset, visible }) => {
    getPublicSiteSettings.mockResolvedValue({
      siteName: "Example Publication",
      appearance: { websiteTemplate: "blog", stylePreset: preset },
    });

    render(await PublicWebsiteShell({ children: <p>Normal page</p> }));

    const sidebar = screen.queryByRole("navigation", { name: "Sidebar" });
    expect(Boolean(sidebar)).toBe(visible);
  },
);

it("omits the sidebar and footer landmarks when their menus are empty", async () => {
  fetchPublic.mockResolvedValue({ header: [], footer: [], sidebar: [] });
  getPublicSiteSettings.mockResolvedValue({
    siteName: "Example Publication",
    appearance: { websiteTemplate: "blog", stylePreset: "minimal" },
  });

  render(await PublicWebsiteShell({ children: <p>Normal page</p> }));

  expect(screen.queryByRole("navigation", { name: "Sidebar" })).toBeNull();
  expect(screen.queryByRole("navigation", { name: "Footer" })).toBeNull();
});
