import { afterEach, expect, it, vi } from "vitest";

import {
  getPublicSiteSettings,
  getPublicSiteSettingsForLayout,
} from "./public-site-settings.server";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

afterEach(() => {
  vi.unstubAllGlobals();
});
it("consumes validated public settings with API-owned defaults", async () => {
  const settings = {
    siteName: "NextPress",
    siteDescription: "A publication powered by NextPress.",
    postListingMode: "PAGINATION",
    postsPerPage: 10,
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(settings)));
  expect(await getPublicSiteSettings()).toEqual(settings);
});
it("does not replace API outages with default settings", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
  );
  await expect(getPublicSiteSettings()).rejects.toMatchObject({ status: 500 });
});

it("uses local layout defaults only when the API is unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(null, {
        status: 500,
        headers: { "x-nextpress-service-unavailable": "1" },
      }),
    ),
  );

  await expect(getPublicSiteSettingsForLayout()).resolves.toEqual({
    siteName: "NextPress",
    siteDescription: "A publication powered by NextPress.",
    postListingMode: "PAGINATION",
    postsPerPage: 10,
  });
});

it("preserves obsolete identifiers for safe canonical resolution", async () => {
  const settings = {
    siteName: "Saved",
    siteDescription: "",
    postListingMode: "PAGINATION",
    postsPerPage: 10,
    appearance: {
      websiteTemplate: "retired",
      stylePreset: "obsolete",
      colorMode: "dark",
    },
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(settings)));
  expect(await getPublicSiteSettings()).toEqual(settings);
});
it("rejects malformed appearance instead of returning successful defaults", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        siteName: "Saved",
        siteDescription: "",
        postListingMode: "PAGINATION",
        postsPerPage: 10,
        appearance: { websiteTemplate: 5 },
      }),
    ),
  );
  await expect(getPublicSiteSettings()).rejects.toMatchObject({
    code: "contract",
  });
});
