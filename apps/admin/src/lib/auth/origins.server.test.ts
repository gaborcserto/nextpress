// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { getAuthBaseURL, getAuthSecret, getTrustedOrigins } from "./origins.server";

afterEach(() => vi.unstubAllEnvs());

function clearURLs() {
  vi.stubEnv("BETTER_AUTH_URL", "");
  vi.stubEnv("NEXT_PUBLIC_BETTER_AUTH_URL", "");
  vi.stubEnv("NEXT_PUBLIC_ADMIN_URL", "");
}

describe("authentication environment configuration", () => {
  it("keeps localhost as the development auth origin", () => {
    vi.stubEnv("NODE_ENV", "development");
    clearURLs();
    expect(getAuthBaseURL()).toBe("http://localhost:49101");
    expect(getTrustedOrigins()).toEqual(["http://localhost:49101"]);
    expect(getAuthSecret()).toBeUndefined();
  });

  it("requires an explicit HTTPS origin and strong secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    clearURLs();
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    expect(() => getAuthBaseURL()).toThrow(/BETTER_AUTH_URL/);
    expect(() => getTrustedOrigins()).toThrow(/BETTER_AUTH_URL/);
    expect(() => getAuthSecret()).toThrow(/BETTER_AUTH_SECRET/);

    vi.stubEnv("BETTER_AUTH_URL", "http://admin.example.com");
    expect(() => getAuthBaseURL()).toThrow(/HTTPS/);
    vi.stubEnv("BETTER_AUTH_URL", "not a url");
    expect(() => getAuthBaseURL()).toThrow();
    vi.stubEnv("BETTER_AUTH_URL", "https://admin.example.com/path");
    expect(() => getAuthBaseURL()).toThrow(/Invalid authentication application URL/);

    vi.stubEnv("BETTER_AUTH_URL", "https://admin.example.com");
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
    expect(getAuthBaseURL()).toBe("https://admin.example.com");
    expect(getTrustedOrigins()).toEqual(["https://admin.example.com"]);
    expect(getAuthSecret()).toBe("x".repeat(32));
  });

  it("rejects an insecure extra production origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "https://admin.example.com");
    vi.stubEnv("NEXT_PUBLIC_ADMIN_URL", "http://other.example.com");
    expect(() => getTrustedOrigins()).toThrow(/HTTPS/);
  });
});
