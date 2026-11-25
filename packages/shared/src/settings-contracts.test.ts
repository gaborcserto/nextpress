import { expect, it } from "vitest";

import { OAUTH_PROVIDERS } from "./oauth-providers";
import {
  SettingsPayloadSchema,
  SettingsResponseSchema,
  SettingsUpdateSchema,
} from "./settings-contracts";

const input = {
  siteName: "Example",
  siteDescription: "",
  siteUrl: "",
  ogImageUrl: "",
  defaultUserRole: "SUBSCRIBER",
  postListingMode: "PAGINATION",
  postsPerPage: 10,
  oauthProviders: OAUTH_PROVIDERS.map((provider) => ({
    provider,
    enabled: false,
    clientId: "",
  })),
};

const readProviders = input.oauthProviders.map((row) => ({
  ...row,
  hasClientId: false,
  hasClientSecret: true,
  operational: false,
}));

it.each([
  ["empty", []],
  ["missing", readProviders.slice(1)],
  ["duplicate", [readProviders[1], ...readProviders.slice(1)]],
  [
    "unsupported",
    [{ ...readProviders[0], provider: "unknown" }, ...readProviders.slice(1)],
  ],
])(
  "rejects %s provider membership on reads and writes",
  (_label, oauthProviders) => {
    const data = { ...input, oauthProviders };
    expect(SettingsResponseSchema.safeParse(data).success).toBe(false);
    expect(SettingsUpdateSchema.safeParse(data).success).toBe(false);
  },
);

it("requires the complete provider set and preserves omitted or blank write-only secrets", () => {
  expect(SettingsUpdateSchema.parse(input)).toEqual(input);
  expect(
    SettingsUpdateSchema.safeParse({ ...input, oauthProviders: [] }).success,
  ).toBe(false);
  expect(
    SettingsPayloadSchema.safeParse({
      ...input,
      oauthProviders: input.oauthProviders.map(() => input.oauthProviders[0]),
    }).success,
  ).toBe(false);
  expect(
    SettingsUpdateSchema.safeParse({ ...input, siteUrl: "javascript:alert(1)" })
      .success,
  ).toBe(false);
  expect(
    SettingsUpdateSchema.safeParse({ ...input, siteName: " " }).success,
  ).toBe(false);
  expect(
    SettingsUpdateSchema.safeParse({ ...input, postsPerPage: 51 }).success,
  ).toBe(false);
});

it("accepts validated appearance as an optional part of the unified save", () => {
  expect(SettingsUpdateSchema.parse(input)).toEqual(input);
  expect(
    SettingsUpdateSchema.parse({
      ...input,
      appearance: {
        websiteTemplate: "blog",
        stylePreset: "modern",
        colorMode: "dark",
      },
    }).appearance,
  ).toEqual({
    websiteTemplate: "blog",
    stylePreset: "modern",
    colorMode: "dark",
  });
  expect(
    SettingsUpdateSchema.safeParse({
      ...input,
      appearance: { websiteTemplate: "unknown" },
    }).success,
  ).toBe(false);
});

it("requires credential presence metadata while stripping secrets from responses", () => {
  expect(SettingsResponseSchema.safeParse(input).success).toBe(false);
  const response = SettingsResponseSchema.parse({
    ...input,
    oauthProviders: input.oauthProviders.map((row) => ({
      ...row,
      hasClientId: false,
      hasClientSecret: true,
      operational: false,
      clientSecret: "must be omitted",
    })),
  });
  expect(response.oauthProviders.every((row) => !("clientSecret" in row))).toBe(
    true,
  );
});
