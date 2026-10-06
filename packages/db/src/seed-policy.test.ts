import { describe, expect, it } from "vitest";

import { getAdminSeedCredentials } from "./seed-policy";

const password = "a private passphrase with enough length";

describe("admin seed policy", () => {
  it("requires explicit valid credentials without a default administrator", () => {
    expect(() => getAdminSeedCredentials({ NODE_ENV: "development" })).toThrow();
    expect(getAdminSeedCredentials({ NODE_ENV: "development", ADMIN_EMAIL: "owner@example.test", ADMIN_PASSWORD: password }))
      .toEqual({ email: "owner@example.test", password });
  });

  it("requires an explicit production opt-in before provisioning an administrator", () => {
    const credentials = { NODE_ENV: "production", ADMIN_EMAIL: "owner@example.test", ADMIN_PASSWORD: password };
    expect(() => getAdminSeedCredentials(credentials)).toThrow(/ALLOW_PRODUCTION_ADMIN_SEED/);
    expect(getAdminSeedCredentials({ ...credentials, ALLOW_PRODUCTION_ADMIN_SEED: "true" }))
      .toEqual({ email: "owner@example.test", password });
  });
});
