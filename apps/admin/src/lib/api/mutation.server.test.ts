import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_MUTATION_BODY_BYTES, readBoundedMutationRequest, requireTrustedMutation } from "./mutation.server";
import { getAuthBaseURL, getTrustedOrigins } from "@/lib/auth/origins.server";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:49101");
  vi.stubEnv("NEXT_PUBLIC_BETTER_AUTH_URL", "");
  vi.stubEnv("NEXT_PUBLIC_ADMIN_URL", "");
});
afterEach(() => vi.unstubAllEnvs());

function request(method = "POST", origin: string | null = "http://localhost:49101", contentType: string | null = "application/json") {
  const headers = new Headers();
  if (origin !== null) headers.set("origin", origin);
  if (contentType !== null) headers.set("content-type", contentType);
  return new Request("http://attacker.invalid/api/test", {
    method, headers, body: ["GET", "HEAD", "OPTIONS", "DELETE"].includes(method) ? undefined : "{}",
  });
}

describe("custom mutation origin and media-type boundary", () => {
  it("preserves small bodies and rejects oversized streamed mutation bodies", async () => {
    const small = await readBoundedMutationRequest(request());
    expect(await small.request?.text()).toBe("{}");

    const largeReq = new Request("http://localhost:49101/api/test", {
      method: "POST",
      headers: { origin: "http://localhost:49101", "content-type": "application/json" },
      body: "x".repeat(MAX_MUTATION_BODY_BYTES + 1),
    });
    const large = await readBoundedMutationRequest(largeReq);
    expect(large.response?.status).toBe(413);
    expect(large.request).toBeUndefined();
  });

  it.each(["application/json", "Application/JSON", "application/json; charset=utf-8", 'application/json; charset="utf-8"'])("accepts trusted JSON requests with %s", (type) => {
    expect(requireTrustedMutation(request("POST", undefined, type))).toBeNull();
  });

  it.each([null, "null", "https://evil.example", "https://localhost:49101", "http://localhost:3000", "http://localhost:49101.evil.example", "http://localhost:49101/", "http://user@localhost:49101", "http://localhost:49101/path", "not-a-url", "http://localhost:49101, https://evil.example"])("rejects absent, malformed, or untrusted Origin %s", async (origin) => {
    const response = requireTrustedMutation(request("POST", origin));
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: "Untrusted request origin" });
  });

  it.each([null, "text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=test", "application/merge-patch+json", "application/jsonp"])("rejects unsupported media type %s", async (type) => {
    const response = requireTrustedMutation(request("PATCH", undefined, type));
    expect(response?.status).toBe(415);
    expect(await response?.json()).toEqual({ error: "Content-Type must be application/json" });
  });

  it("does not trust Host, forwarded headers, Fetch Metadata or Referer in place of Origin", () => {
    const req = request("POST", null);
    for (const header of ["host", "x-forwarded-host"]) req.headers.set(header, "localhost:49101");
    req.headers.set("x-forwarded-proto", "http");
    req.headers.set("sec-fetch-site", "same-origin");
    req.headers.set("referer", "http://localhost:49101/admin");
    expect(requireTrustedMutation(req)?.status).toBe(403);
  });

  it.each(["GET", "HEAD", "OPTIONS"])("leaves %s unchanged", (method) => {
    expect(requireTrustedMutation(request(method, null, "text/plain"))).toBeNull();
  });

  it("allows a trusted bodyless DELETE but checks its origin and any body media type", () => {
    expect(requireTrustedMutation(request("DELETE", undefined, null))).toBeNull();
    expect(requireTrustedMutation(request("DELETE", null, null))?.status).toBe(403);
    expect(requireTrustedMutation(new Request("http://localhost:49101/api/test", {
      method: "DELETE", headers: { origin: "http://localhost:49101" }, body: "{}",
    }))?.status).toBe(415);
  });

  it("trusts the canonical localhost development origin", () => {
    expect(getTrustedOrigins()).toEqual(["http://localhost:49101"]);
    expect(requireTrustedMutation(request("POST", "http://127.0.0.1:49101"))?.status).toBe(403);
  });

  it("uses only configured HTTPS origins in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "https://admin.example.com");
    vi.stubEnv("NEXT_PUBLIC_ADMIN_URL", "https://admin.example.com/");
    expect(getAuthBaseURL()).toBe("https://admin.example.com");
    expect(getTrustedOrigins()).toEqual(["https://admin.example.com"]);
    expect(requireTrustedMutation(request("POST", "https://admin.example.com"))).toBeNull();
    expect(requireTrustedMutation(request())?.status).toBe(403);
    expect(requireTrustedMutation(request("POST", "https://other.example.com"))?.status).toBe(403);
  });

  it.each(["http://admin.example.com", "http://localhost:49101", "https://localhost:49101", "https://127.0.0.1:49101", "https://[::1]:49101"])("fails closed for production development/insecure configuration %s", (url) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", url);
    expect(getAuthBaseURL).toThrow("Production authentication requires an HTTPS application URL");
    expect(getTrustedOrigins).toThrow();
  });

  it("requires production configuration rather than trusting a request URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "");
    expect(getAuthBaseURL).toThrow();
  });
});
