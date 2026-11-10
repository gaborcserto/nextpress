// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ headers: requestHeaders }));
import {
  getOperationalOAuthProviders,
  getSessionWithRole,
} from "./session.server";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("forwards only auth cookies, validates the discovery contract and disables caching", async () => {
  vi.stubEnv("API_INTERNAL_ORIGIN", "http://localhost:49102");
  requestHeaders.mockResolvedValue(
    new Headers({
      cookie:
        "theme=dark; better-auth.session_token=test; __Secure-better-auth.state=state",
    }),
  );
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ user: { id: "user", name: "User", role: "AUTHOR" } }),
    );
  vi.stubGlobal("fetch", fetcher);
  expect(await getSessionWithRole()).toEqual({
    user: { id: "user", name: "User", role: "AUTHOR" },
  });
  expect(fetcher).toHaveBeenCalledWith(
    "http://localhost:49102/api/discovery/session",
    expect.objectContaining({
      headers: {
        cookie:
          "better-auth.session_token=test; __Secure-better-auth.state=state",
      },
      cache: "no-store",
      redirect: "error",
    }),
  );
});
it("returns null for an anonymous session", async () => {
  requestHeaders.mockResolvedValue(new Headers());
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ user: null })),
  );
  expect(await getSessionWithRole()).toBeNull();
});
it("does not turn an outage into an anonymous session or provider fallback", async () => {
  requestHeaders.mockResolvedValue(new Headers());
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
  );
  await expect(getSessionWithRole()).rejects.toThrow(
    "API discovery unavailable",
  );
  await expect(getOperationalOAuthProviders()).rejects.toThrow(
    "API discovery unavailable",
  );
});
it("rejects malformed discovery data", async () => {
  requestHeaders.mockResolvedValue(new Headers());
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(Response.json({ user: { id: "user", role: "ROOT" } })),
  );
  await expect(getSessionWithRole()).rejects.toThrow();
});

it("propagates connection failures rather than reporting an anonymous session", async () => {
  requestHeaders.mockResolvedValue(new Headers());
  const cause = Object.assign(new Error("Connection refused"), {
    code: "ECONNREFUSED",
  });
  const failure = new TypeError("fetch failed", { cause });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));
  await expect(getSessionWithRole()).rejects.toBe(failure);
  await expect(getOperationalOAuthProviders()).rejects.toBe(failure);
});
