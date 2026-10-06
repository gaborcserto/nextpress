import { describe, expect, it } from "vitest";

import {
  buildSettingsPayload,
  normalizeSettingsForm,
  type SettingsFormValues,
} from "./admin-settings";

describe("admin settings contracts", () => {
  it("normalizes missing optional settings", () => {
    expect(normalizeSettingsForm(undefined, "SUBSCRIBER")).toEqual({
      siteName: "",
      siteDescription: "",
      siteUrl: "",
      ogImageUrl: "",
      defaultUserRole: "SUBSCRIBER",
      postListingMode: "PAGINATION",
      postsPerPage: 10,
      oauthProviders: [],
    });
  });

  it("uses safe defaults when stored listing settings are missing or invalid", () => {
    expect(normalizeSettingsForm({ postListingMode: "UNKNOWN", postsPerPage: 500 }, "SUBSCRIBER"))
      .toMatchObject({ postListingMode: "PAGINATION", postsPerPage: 10 });
  });

  it("adds only explicitly entered provider secrets to the payload", () => {
    const form: SettingsFormValues = {
      siteName: "NextPress",
      siteDescription: "",
      siteUrl: "https://example.com",
      ogImageUrl: "",
      defaultUserRole: "AUTHOR",
      postListingMode: "LOAD_MORE",
      postsPerPage: 20,
      oauthProviders: [
        {
          provider: "github",
          enabled: true,
          clientId: "client-id",
          hasClientId: true,
          hasClientSecret: true,
          operational: true,
        },
      ],
    };

    expect(buildSettingsPayload(form, {})).toEqual({
      siteName: "NextPress",
      siteDescription: "",
      siteUrl: "https://example.com",
      ogImageUrl: "",
      defaultUserRole: "AUTHOR",
      postListingMode: "LOAD_MORE",
      postsPerPage: 20,
      oauthProviders: [
        { provider: "github", enabled: true, clientId: "client-id" },
      ],
    });

    expect(
      buildSettingsPayload(form, { github: { clientSecret: "new-secret" } })
        .oauthProviders[0],
    ).toMatchObject({ clientSecret: "new-secret" });
  });

  it("does not build a settings payload with an out-of-range batch size", () => {
    const form = normalizeSettingsForm({
      siteName: "NextPress", postListingMode: "PAGINATION", postsPerPage: 10, oauthProviders: [],
    }, "SUBSCRIBER");
    expect(() => buildSettingsPayload({ ...form, postsPerPage: 51 }, {})).toThrow();
  });
});
