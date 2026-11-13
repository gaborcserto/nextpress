import { expect, it, vi } from "vitest";

vi.mock("@/lib/i18n/server", () => ({ getLocale: async () => "hu" }));
vi.mock("@/lib/settings/public-site-settings.server", () => ({
  getPublicSiteSettings: async () => ({ appearance: {} }),
}));
const fetchPublic = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/public-api.server", () => ({ fetchPublic }));

import SearchPage, { generateMetadata } from "./page";

it("marks localized search pages noindex", async () => {
  expect(await generateMetadata()).toMatchObject({
    robots: { index: false, follow: true },
  });
});

it("propagates upstream failures to the localized search error boundary", async () => {
  fetchPublic.mockRejectedValue(new Error("Unavailable"));
  await expect(
    SearchPage({ searchParams: Promise.resolve({ q: "react" }) }),
  ).rejects.toThrow("Unavailable");
});
