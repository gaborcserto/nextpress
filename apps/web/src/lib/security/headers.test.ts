import { afterEach, describe, expect, it, vi } from "vitest";

import { webSecurityHeaders } from "./headers";
import nextConfig from "../../../next.config";

describe("public web HTTP security policy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("limits the framing exception to the configured preview origin and route", async () => {
    vi.stubEnv("PREVIEW_ADMIN_ORIGIN", "https://admin.example.test");
    const routes = await nextConfig.headers?.();
    const preview = routes?.find((route) => route.source === "/live-preview");
    expect(
      preview?.headers.find(
        (header) => header.key === "Content-Security-Policy",
      )?.value,
    ).toContain("frame-ancestors https://admin.example.test");
    expect(
      preview?.headers.find((header) => header.key === "X-Frame-Options"),
    ).toBeUndefined();
    expect(
      routes?.find((route) => route.source !== "/live-preview")?.headers,
    ).toEqual(webSecurityHeaders(false));
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("denies preview framing when no admin origin is configured", async () => {
    vi.stubEnv("PREVIEW_ADMIN_ORIGIN", "");
    const routes = await nextConfig.headers?.();
    expect(
      routes
        ?.find((route) => route.source === "/live-preview")
        ?.headers.find((header) => header.key === "Content-Security-Policy")
        ?.value,
    ).toContain("frame-ancestors 'none'");
  });

  it("limits sources to the current static frontend and denies framing", () => {
    const headers = Object.fromEntries(
      webSecurityHeaders(true).map(({ key, value }) => [key, value]),
    );
    const policy = headers["Content-Security-Policy"];

    for (const directive of [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "script-src-attr 'none'",
      "style-src 'self'",
      "style-src-attr 'unsafe-inline'",
      "img-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
    ]) {
      expect(policy.split("; ")).toContain(directive);
    }
    expect(policy).not.toMatch(/unsafe-eval|\*|https:|data:|blob:/);
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000");
  });

  it("permits local development without HTTPS upgrades or HSTS", () => {
    const headers = Object.fromEntries(
      webSecurityHeaders(false).map(({ key, value }) => [key, value]),
    );
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
    expect(headers["Content-Security-Policy"]).toContain("'unsafe-eval'");
    expect(headers["Content-Security-Policy"]).toContain("ws: wss:");
    expect(headers["Content-Security-Policy"]).not.toContain(
      "upgrade-insecure-requests",
    );
  });
});
