vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () =>
      request.savedMode === undefined
        ? undefined
        : { value: request.savedMode },
  }),
  headers: async () => new Headers(),
}));
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublicSiteSettings, request } = vi.hoisted(() => ({
  request: { savedMode: undefined as string | undefined },
  getPublicSiteSettings: vi.fn(),
}));
vi.mock("@/lib/settings/public-site-settings.server", () => ({
  getPublicSiteSettings,
}));
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist-sans" }),
  Geist_Mono: () => ({ variable: "geist-mono" }),
}));

import RootLayout, { generateMetadata } from "./layout";

beforeEach(() => {
  vi.resetAllMocks();
  request.savedMode = undefined;
  getPublicSiteSettings.mockResolvedValue({
    siteName: "Example Publication",
    siteDescription: "Independent reporting.",
  });
});

describe("public layout settings integration", () => {
  it("server-renders System when no valid site or visitor default exists", async () => {
    const markup = renderToStaticMarkup(
      await RootLayout({ children: <p>Page content</p> }),
    );
    const html = new DOMParser().parseFromString(
      markup,
      "text/html",
    ).documentElement;
    expect(html.getAttribute("data-skin")).toBe("default");
    expect(html.getAttribute("data-scroll-behavior")).toBe("smooth");
    expect(html.getAttribute("data-color-mode")).toBe("system");
    expect(html.hasAttribute("data-theme")).toBe(false);
  });

  it("leaves route content outside the regular site shell", async () => {
    render(await RootLayout({ children: <p>Page content</p> }), {
      container: document,
    });

    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("uses the same public identity for the existing title and description metadata", async () => {
    expect(await generateMetadata()).toEqual({
      title: "Example Publication",
      description: "Independent reporting.",
      metadataBase: new URL("http://localhost:49100"),
      robots: { index: true, follow: true },
      openGraph: { siteName: "Example Publication", type: "website" },
    });
  });

  it("propagates settings failures to the root error boundary", async () => {
    getPublicSiteSettings.mockRejectedValue(
      new Error("private settings failure"),
    );
    await expect(RootLayout({ children: <p>Page content</p> })).rejects.toThrow(
      "private settings failure",
    );
  });
});

it.each(["light", "dark", "system"])(
  "SSR applies saved %s with validated template/preset selectors",
  async (colorMode) => {
    getPublicSiteSettings.mockResolvedValue({
      siteName: "Saved",
      appearance: {
        websiteTemplate: "blog",
        stylePreset: "classic",
        colorMode,
      },
    });
    const markup = renderToStaticMarkup(
      await RootLayout({ children: <p>Content</p> }),
    );
    expect(markup).toContain(`data-color-mode="${colorMode}"`);
    expect(markup).toContain('data-website-template="blog"');
    expect(markup).toContain('data-style-preset="classic"');
  },
);

it.each(["light", "dark", "system"])(
  "SSR visitor %s overrides an explicit site default",
  async (mode) => {
    request.savedMode = mode;
    getPublicSiteSettings.mockResolvedValue({
      siteName: "Saved",
      appearance: {
        websiteTemplate: "blog",
        stylePreset: "classic",
        colorMode: "dark",
      },
    });
    expect(
      renderToStaticMarkup(await RootLayout({ children: <p>Content</p> })),
    ).toContain(`data-color-mode="${mode}"`);
  },
);

it("rejects invalid visitor preferences and falls back to the saved site mode", async () => {
  request.savedMode = "invalid";
  getPublicSiteSettings.mockResolvedValue({
    siteName: "Saved",
    appearance: {
      websiteTemplate: "blog",
      stylePreset: "classic",
      colorMode: "dark",
    },
  });
  expect(
    renderToStaticMarkup(await RootLayout({ children: <p>Content</p> })),
  ).toContain('data-color-mode="dark"');
});

it("uses System for an invalid site color mode without mutating site settings", async () => {
  getPublicSiteSettings.mockResolvedValue({
    siteName: "Saved",
    appearance: {
      websiteTemplate: "blog",
      stylePreset: "classic",
      colorMode: "obsolete",
    },
  });
  expect(
    renderToStaticMarkup(await RootLayout({ children: <p>Content</p> })),
  ).toContain('data-color-mode="system"');
});
