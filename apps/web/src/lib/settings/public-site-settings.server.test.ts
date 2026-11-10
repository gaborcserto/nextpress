import { afterEach, expect, it, vi } from "vitest";

import { getPublicSiteSettings } from "./public-site-settings.server";

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
