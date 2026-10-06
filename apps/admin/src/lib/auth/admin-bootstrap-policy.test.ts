import { describe, expect, it } from "vitest";

import { getAdminBootstrapCredentials } from "./admin-bootstrap-policy";

const password = "a private passphrase with enough length";

describe("admin bootstrap policy", () => {
  it("requires explicit valid credentials without a default administrator", () => {
    expect(() => getAdminBootstrapCredentials({ NODE_ENV: "development" })).toThrow();
    expect(getAdminBootstrapCredentials({ NODE_ENV: "development", ADMIN_EMAIL: "owner@example.test", ADMIN_PASSWORD: password }))
      .toEqual({ email: "owner@example.test", password });
  });

  it("requires the original explicit opt-in for production admin provisioning", () => {
    const credentials = { NODE_ENV: "production", ADMIN_EMAIL: "owner@example.test", ADMIN_PASSWORD: password } satisfies NodeJS.ProcessEnv;
    expect(() => getAdminBootstrapCredentials(credentials)).toThrow(/ALLOW_PRODUCTION_ADMIN_SEED/);
    expect(getAdminBootstrapCredentials({ ...credentials, ALLOW_PRODUCTION_ADMIN_SEED: "true" })).toEqual({ email: "owner@example.test", password });
  });
});
