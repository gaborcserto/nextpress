import { describe, expect, it, vi } from "vitest";

import { adminContentSecurityPolicy, adminSecurityHeaders } from "./headers";
import nextConfig from "../../../next.config";

describe("admin HTTP security policy", () => {
  it("protects every route, including assets, through Next configuration", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(await nextConfig.headers?.()).toEqual([
      { source: "/:path*", headers: adminSecurityHeaders(false) },
    ]);
  });

  it("loads normal Next configuration without administrator bootstrap credentials", async () => {
    vi.stubEnv("ADMIN_EMAIL", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    vi.resetModules();

    try {
      const { default: config } = await import("../../../next.config");

      expect(await config.headers?.()).toEqual([
        { source: "/:path*", headers: adminSecurityHeaders(false) },
      ]);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("sets conservative browser protections and production-only host-scoped HSTS", () => {
    const headers = Object.fromEntries(adminSecurityHeaders(true).map(({ key, value }) => [key, value]));
    expect(headers).toEqual({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Strict-Transport-Security": "max-age=31536000",
    });
    expect(adminSecurityHeaders(false).some(({ key }) => key === "Strict-Transport-Security")).toBe(false);
  });

  it("requires nonced scripts and narrow resource sources in production", () => {
    const policy = adminContentSecurityPolicy("test-nonce", true);
    for (const directive of [
      "default-src 'self'", "script-src 'self' 'nonce-test-nonce' 'strict-dynamic'",
      "script-src-attr 'none'", "style-src 'self' 'nonce-test-nonce'", "style-src-attr 'unsafe-inline'",
      "img-src 'self' https:", "font-src 'self'", "connect-src 'self'",
      "frame-src 'none'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'none'",
      "form-action 'self'", "upgrade-insecure-requests",
    ]) expect(policy.split("; ")).toContain(directive);
    expect(policy).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline|\*|data:|blob:|http:|ws:/);
  });

  it("keeps development eval, styles, WebSockets, and HTTP usable", () => {
    const policy = adminContentSecurityPolicy("test-nonce", false);
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain("connect-src 'self' ws: wss:");
    expect(policy).not.toContain("upgrade-insecure-requests");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("allows only the configured auth connection origin, without provider-wide grants", () => {
    expect(adminContentSecurityPolicy("test-nonce", true, "https://auth.example/api/auth"))
      .toContain("connect-src 'self' https://auth.example;");
    for (const url of ["http://auth.example", "javascript:alert(1)", "https://user:password@auth.example"]) {
      expect(() => adminContentSecurityPolicy("test-nonce", true, url)).toThrow();
    }
  });
});
