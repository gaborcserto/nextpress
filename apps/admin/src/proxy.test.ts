// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy, config } from "./proxy";

afterEach(() => vi.unstubAllEnvs());

describe("Next.js CSP proxy", () => {
  it("forwards the effective policy, overwrites attacker CSP, and uses fresh nonces", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BETTER_AUTH_URL", "");
    const request = new NextRequest("https://admin.example/auth/sign-in", {
      headers: {
        "Content-Security-Policy": "script-src 'nonce-attacker'",
        "Content-Security-Policy-Report-Only": "script-src 'nonce-attacker'",
        origin: "https://admin.example",
        cookie: "test=session",
      },
    });
    const response = proxy(request);
    const policy = response.headers.get("Content-Security-Policy");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("attacker");
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
    expect(response.headers.has("x-middleware-request-content-security-policy-report-only")).toBe(false);
    expect(response.headers.get("x-middleware-request-origin")).toBe("https://admin.example");
    expect(response.headers.get("x-middleware-request-cookie")).toBe("test=session");
    expect(policy).toMatch(/'nonce-[A-Za-z0-9+/]{22}=='/);
    expect(proxy(request).headers.get("Content-Security-Policy")).not.toBe(policy);
  });

  it("covers callback/error/API/prefetch requests while skipping Next assets", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    for (const path of ["/", "/auth/sign-in", "/api/auth/callback/google", "/api/pages", "/missing"]) {
      expect(matcher.test(path)).toBe(true);
    }
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BETTER_AUTH_URL", "http://localhost:49101");
    const response = proxy(new NextRequest("http://localhost:49101/admin", { headers: { "next-router-prefetch": "1" } }));
    expect(response.headers.get("Content-Security-Policy")).toContain("'unsafe-eval'");
  });

  it("allows data images only on the API documentation route", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BETTER_AUTH_URL", "");
    const docsPolicy = proxy(new NextRequest("https://admin.example/api-docs")).headers
      .get("Content-Security-Policy");
    const assetPolicy = proxy(new NextRequest("https://admin.example/api-docs/swagger-ui.css")).headers
      .get("Content-Security-Policy");
    const apiPolicy = proxy(new NextRequest("https://admin.example/api/pages")).headers
      .get("Content-Security-Policy");

    expect(docsPolicy).toContain("img-src 'self' https: data:");
    expect(assetPolicy).toContain("img-src 'self' https: data:");
    expect(apiPolicy).toContain("img-src 'self' https:");
    expect(apiPolicy).not.toContain("data:");
  });
});
