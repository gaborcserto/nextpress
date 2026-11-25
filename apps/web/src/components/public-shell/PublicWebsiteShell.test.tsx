import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { fetchPublic, getPublicSiteSettings, writeServerLog } = vi.hoisted(
  () => ({
    fetchPublic: vi.fn(),
    getPublicSiteSettings: vi.fn(),
    writeServerLog: vi.fn(),
  }),
);

vi.mock("@/lib/content/public-api.server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/content/public-api.server")>();

  return { ...actual, fetchPublic };
});
vi.mock("@/lib/settings/public-site-settings.server", () => ({
  getPublicSiteSettings,
}));
vi.mock("@/templates/blog/MenuTree", () => ({
  MenuTree: ({ items }: { items: PublicMenuItem[] }) => (
    <ul>
      {items.map(({ href, label }, index) => (
        <li key={index}>
          <a href={href?.startsWith("/") ? `/en${href}` : (href ?? "")}>
            {label}
          </a>
        </li>
      ))}
    </ul>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-nextpress-render-id": "9a6f2be8-7b14-4a92-a434-e4f5c452d472",
    }),
}));
vi.mock("@nextpress/shared/server-logging", () => ({ writeServerLog }));

import { PublicApiError } from "@/lib/content/public-api.server";

import { PublicWebsiteShell } from "./PublicWebsiteShell";

import type { PublicMenuItem } from "@nextpress/shared/api-contracts";

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

it("keeps public content available and logs when optional navigation is unavailable", async () => {
  fetchPublic.mockRejectedValue(new PublicApiError(500, "upstream"));

  render(await PublicWebsiteShell({ children: <p>Normal page</p> }));

  expect(screen.getByText("Normal page")).toBeInTheDocument();
  expect(screen.getByRole("banner")).toBeInTheDocument();
  expect(writeServerLog).toHaveBeenCalledWith(
    "web",
    "public.navigation.degraded",
    expect.objectContaining({
      requestId: "9a6f2be8-7b14-4a92-a434-e4f5c452d472",
      operation: "public.content",
      code: "upstream",
      status: 500,
    }),
  );
});
