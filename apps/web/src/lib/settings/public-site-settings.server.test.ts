import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@nextpress/db", () => ({ prisma: { siteSettings: { findUnique } } }));

import { getPublicSiteSettings } from "./public-site-settings.server";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("public site settings boundary", () => {
  it("reads only public identity fields and excludes internal data from the result", async () => {
    findUnique.mockResolvedValue({
      siteName: " Example Publication ",
      siteDescription: " Independent reporting. ",
      id: "default",
      defaultUserRole: "ADMIN",
      siteUrl: "https://example.test",
      ogImageUrl: "https://example.test/cover.png",
      createdAt: new Date(),
      updatedAt: new Date(),
      oauthProviders: [{ clientId: "private-client", clientSecret: "private-secret" }],
      futurePrivateSetting: "private-value",
    });

    expect(await getPublicSiteSettings()).toEqual({
      siteName: "Example Publication",
      siteDescription: "Independent reporting.",
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "default" },
      select: { siteName: true, siteDescription: true },
    });
  });

  it.each([
    null,
    { siteName: "NextPress", siteDescription: null },
    { siteName: "", siteDescription: "" },
    { siteName: "  ", siteDescription: "  " },
  ])("uses existing identity defaults for missing or blank configuration: %j", async (settings) => {
    findUnique.mockResolvedValue(settings);

    expect(await getPublicSiteSettings()).toEqual({
      siteName: "NextPress",
      siteDescription: "A publication powered by NextPress.",
    });
  });

  it("preserves a configured name when the optional description is absent", async () => {
    findUnique.mockResolvedValue({ siteName: "Example Publication", siteDescription: null });

    expect(await getPublicSiteSettings()).toEqual({
      siteName: "Example Publication",
      siteDescription: "A publication powered by NextPress.",
    });
  });

  it("propagates database failures instead of treating them as missing configuration", async () => {
    const failure = new Error("Database unavailable");
    findUnique.mockRejectedValue(failure);

    await expect(getPublicSiteSettings()).rejects.toBe(failure);
  });
});
