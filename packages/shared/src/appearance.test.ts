import { describe, expect, it } from "vitest";

import { PublicSiteSettingsSchema } from "./api-contracts";
import {
  AppearanceSchema,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  APPEARANCE_CATALOG,
} from "./appearance";

const oldResponse = {
  siteName: "Publication",
  siteDescription: "Description",
  postListingMode: "PAGINATION",
  postsPerPage: 10,
};
const newResponse = { ...oldResponse, appearance: DEFAULT_APPEARANCE };

describe("appearance contract", () => {
  it.each(["light", "dark", "system"])(
    "accepts implemented combinations in %s",
    (colorMode) => {
      expect(
        AppearanceSchema.parse({ ...DEFAULT_APPEARANCE, colorMode }).colorMode,
      ).toBe(colorMode);
    },
  );
  it("advertises only implemented options", () => {
    expect(
      APPEARANCE_CATALOG.map((entry) => [
        entry.id,
        entry.presets.map((preset) => preset.id),
      ]),
    ).toEqual([["blog", ["classic", "modern", "minimal"]]]);
  });
  it.each([
    {},
    null,
    { ...DEFAULT_APPEARANCE, websiteTemplate: "corporate" },
    { ...DEFAULT_APPEARANCE, stylePreset: "unavailable" },

    { ...DEFAULT_APPEARANCE, colorMode: "sepia" },
    { ...DEFAULT_APPEARANCE, siteName: "injected" },
  ])("rejects invalid administrative writes %j", (value) => {
    expect(AppearanceSchema.safeParse(value).success).toBe(false);
  });
  it.each([
    undefined,
    null,
    {},
    {
      websiteTemplate: "obsolete",
      stylePreset: "modern",
      colorMode: "obsolete",
    },
  ])("normalizes missing and obsolete data %j", (value) => {
    expect(normalizeAppearance(value)).toEqual(DEFAULT_APPEARANCE);
  });
  it("normalizes identifiers independently", () => {
    expect(
      normalizeAppearance({
        websiteTemplate: "blog",
        stylePreset: "obsolete",
        colorMode: "dark",
      }),
    ).toEqual({ ...DEFAULT_APPEARANCE, colorMode: "dark" });
  });
  it.each([oldResponse, newResponse])(
    "accepts old and expanded public response fixtures",
    (value) => {
      expect(PublicSiteSettingsSchema.parse(value)).toEqual(value);
    },
  );
  it.each([
    null,
    "classic",
    {},
    { ...DEFAULT_APPEARANCE, colorMode: 1 },
    { ...DEFAULT_APPEARANCE, clientSecret: "secret" },
  ])(
    "does not normalize malformed wire objects %j into success",
    (appearance) => {
      expect(
        PublicSiteSettingsSchema.safeParse({ ...oldResponse, appearance })
          .success,
      ).toBe(false);
    },
  );
});
