import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@nextpress/db", () => ({ prisma: { siteSettings: { findUnique } } }));

import { getPublicSiteSettings } from "./settings.server";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("public site settings boundary", () => {
  it("reads only public identity fields and excludes internal data from the result", async () => {
    findUnique.mockResolvedValue({
      siteName: " Example Publication ",
      siteDescription: " Independent reporting. ",
      postListingMode: "LOAD_MORE",
      postsPerPage: 25,
      id: "default",
      defaultUserRole: "ADMIN",
      siteUrl: "https://example.test",
      ogImageUrl: "https://example.test/cover.png",
      createdAt: new Date(),
      updatedAt: new Date(),
      oauthProviders: [
        { clientId: "private-client", clientSecret: "private-secret" },
      ],
      futurePrivateSetting: "private-value",
    });

    expect(await getPublicSiteSettings()).toEqual({
      siteName: "Example Publication",
      siteDescription: "Independent reporting.",
      postListingMode: "LOAD_MORE",
      postsPerPage: 25,
      appearance: {
        websiteTemplate: "blog",
        stylePreset: "classic",
        colorMode: "light",
      },
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "default" },
      select: {
        websiteTemplate: true,
        stylePreset: true,
        colorMode: true,
        siteName: true,
        siteDescription: true,
        postListingMode: true,
        postsPerPage: true,
      },
    });
  });

  it.each([
    null,
    {
      siteName: "NextPress",
      siteDescription: null,
      postListingMode: "PAGINATION",
      postsPerPage: 10,
    },
    {
      siteName: "",
      siteDescription: "",
      postListingMode: "PAGINATION",
      postsPerPage: 10,
    },
    {
      siteName: "  ",
      siteDescription: "  ",
      postListingMode: "PAGINATION",
      postsPerPage: 10,
    },
  ])(
    "uses existing identity defaults for missing or blank configuration: %j",
    async (settings) => {
      findUnique.mockResolvedValue(settings);

      expect(await getPublicSiteSettings()).toEqual({
        siteName: "NextPress",
        siteDescription: "A publication powered by NextPress.",
        postListingMode: "PAGINATION",
        postsPerPage: 10,
        appearance: {
          websiteTemplate: "blog",
          stylePreset: "classic",
          colorMode: "light",
        },
      });
    },
  );

  it("preserves a configured name when the optional description is absent", async () => {
    findUnique.mockResolvedValue({
      siteName: "Example Publication",
      siteDescription: null,
      postListingMode: "UNSUPPORTED",
      postsPerPage: 500,
    });

    expect(await getPublicSiteSettings()).toEqual({
      siteName: "Example Publication",
      siteDescription: "A publication powered by NextPress.",
      postListingMode: "PAGINATION",
      postsPerPage: 10,
      appearance: {
        websiteTemplate: "blog",
        stylePreset: "classic",
        colorMode: "light",
      },
    });
  });

  it("defaults only the new listing fields for a settings row predating the migration", async () => {
    findUnique.mockResolvedValue({
      siteName: "Legacy publication",
      siteDescription: null,
    });

    expect(await getPublicSiteSettings()).toEqual({
      siteName: "Legacy publication",
      siteDescription: "A publication powered by NextPress.",
      postListingMode: "PAGINATION",
      postsPerPage: 10,
      appearance: {
        websiteTemplate: "blog",
        stylePreset: "classic",
        colorMode: "light",
      },
    });
  });

  it("propagates database failures instead of treating them as missing configuration", async () => {
    const failure = new Error("Database unavailable");
    findUnique.mockRejectedValue(failure);

    await expect(getPublicSiteSettings()).rejects.toBe(failure);
  });
});

it.each([
  [
    { websiteTemplate: "retired", stylePreset: "modern", colorMode: "dark" },
    { websiteTemplate: "blog", stylePreset: "classic", colorMode: "dark" },
  ],
  [
    { websiteTemplate: "blog", stylePreset: "obsolete", colorMode: "obsolete" },
    { websiteTemplate: "blog", stylePreset: "classic", colorMode: "light" },
  ],
])(
  "normalizes persisted obsolete identifiers without exposing other fields",
  async (stored, appearance) => {
    findUnique.mockResolvedValue({
      siteName: "Saved",
      ...stored,
      clientSecret: "secret",
    });
    const settings = await getPublicSiteSettings();
    expect(settings.appearance).toEqual(appearance);
    expect(settings).not.toHaveProperty("clientSecret");
  },
);
