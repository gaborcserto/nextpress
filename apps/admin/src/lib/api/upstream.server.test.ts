// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

import { apiOrigin, forwardApiRequest } from "./upstream.server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("forwards method, body, cookies and exact Origin only to the configured origin", async () => {
  vi.stubEnv("API_INTERNAL_ORIGIN", "http://127.0.0.1:49102");
  const fetcher = vi.fn(async (_url: URL, init: RequestInit) => {
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("origin")).toBe(
      "https://hostile.example",
    );
    expect(new Headers(init.headers).get("cookie")).toBe("session=test");
    expect(new Headers(init.headers).has("x-forwarded-host")).toBe(false);
    expect(new Headers(init.headers).has("x-user-role")).toBe(false);
    expect(init.redirect).toBe("manual");
    expect(init.cache).toBe("no-store");
    expect(await new Response(init.body).text()).toBe('{"title":"test"}');

    return Response.json(
      { error: "Untrusted request origin" },
      { status: 403 },
    );
  });
  vi.stubGlobal("fetch", fetcher);
  const response = await forwardApiRequest(
    new Request("https://admin.example/api/post?host=evil.example", {
      method: "POST",
      headers: {
        origin: "https://hostile.example",
        cookie: "session=test",
        "x-forwarded-host": "evil.example",
        "x-user-role": "ADMIN",
        "content-type": "application/json",
      },
      body: '{"title":"test"}',
    }),
  );
  expect(fetcher.mock.calls[0][0].href).toBe(
    "http://127.0.0.1:49102/api/post?host=evil.example",
  );
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "Untrusted request origin" });
});

it("preserves separate cookies, logout deletions and OAuth redirects without caching", async () => {
  const headers = new Headers({
    location: "https://provider.example/authorize",
  });
  headers.append(
    "set-cookie",
    "session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
  );
  headers.append(
    "set-cookie",
    "oauth=state; Path=/; HttpOnly; Secure; SameSite=Lax",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 302, headers })),
  );
  const response = await forwardApiRequest(
    new Request("https://admin.example/api/auth/callback/github"),
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(
    "https://provider.example/authorize",
  );
  expect(response.headers.getSetCookie()).toEqual(headers.getSetCookie());
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

it.each([401, 404, 409, 429, 500])(
  "propagates status %s and Retry-After",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: "failure" },
            { status, headers: { "retry-after": "30" } },
          ),
        ),
    );
    const response = await forwardApiRequest(
      new Request("http://localhost/api/post"),
    );
    expect(response.status).toBe(status);
    expect(response.headers.get("retry-after")).toBe("30");
  },
);

it("does not fabricate a missing Origin", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 403 }));
  vi.stubGlobal("fetch", fetcher);
  await forwardApiRequest(
    new Request("http://localhost/api/post", { method: "DELETE" }),
  );
  expect(new Headers(fetcher.mock.calls[0][1].headers).has("origin")).toBe(
    false,
  );
});

it("returns a stable 502 on outage", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("private internal detail")),
  );
  const response = await forwardApiRequest(
    new Request("http://localhost/api/post"),
  );
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "API unavailable" });
});

it.each([
  "https://user:secret@api.example",
  "https://api.example/path",
  "ftp://api.example",
  "https://api.example?target=evil",
])("rejects invalid fixed origin %s", (value) => {
  vi.stubEnv("API_INTERNAL_ORIGIN", value);
  expect(apiOrigin).toThrow();
});
