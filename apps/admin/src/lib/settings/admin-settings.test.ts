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
      oauthProviders: [],
    });
  });

  it("adds only explicitly entered provider secrets to the payload", () => {
    const form: SettingsFormValues = {
      siteName: "NextPress",
      siteDescription: "",
      siteUrl: "https://example.com",
      ogImageUrl: "",
      defaultUserRole: "AUTHOR",
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
      oauthProviders: [
        { provider: "github", enabled: true, clientId: "client-id" },
      ],
    });

    expect(
      buildSettingsPayload(form, { github: { clientSecret: "new-secret" } })
        .oauthProviders[0],
    ).toMatchObject({ clientSecret: "new-secret" });
  });
});
