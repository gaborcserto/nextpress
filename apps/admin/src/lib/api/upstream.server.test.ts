// @vitest-environment node
import {
  apiRequestId,
  isRequestId,
  newRequestId,
  requestIdHeader,
  requestSignatureHeader,
} from "@nextpress/shared/request-correlation";
import { afterEach, expect, it, vi } from "vitest";

import { apiOrigin, forwardApiRequest } from "./upstream.server";

afterEach(() => {
  vi.restoreAllMocks();
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

it("forwards auth overload without giving client identity headers to the API", async () => {
  vi.stubEnv("API_INTERNAL_ORIGIN", "http://127.0.0.1:49102");
  const clientIdentityHeaders = {
    "x-forwarded-for": "192.0.2.42",
    "x-real-ip": "192.0.2.42",
    forwarded: "for=192.0.2.42",
    "x-caller-id": "untrusted",
  };
  const body = {
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests. Please try again later.",
  };
  const fetcher = vi.fn(async (target: URL, init: RequestInit) => {
    expect(target.href).toBe("http://127.0.0.1:49102/api/auth/sign-in/email");
    const headers = new Headers(init.headers);

    for (const name of Object.keys(clientIdentityHeaders)) {
      expect(headers.has(name)).toBe(false);
    }

    return Response.json(body, { status: 429 });
  });
  vi.stubGlobal("fetch", fetcher);

  const response = await forwardApiRequest(
    new Request("https://admin.example/api/auth/sign-in/email", {
      method: "POST",
      headers: clientIdentityHeaders,
    }),
  );

  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBeNull();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual(body);
});

it("preserves separate cookies, logout deletions and OAuth redirects without caching", async () => {
  const headers = new Headers({
    location: "https://provider.example/authorize",
    [requestSignatureHeader]: "internal-test-value",
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
  expect(response.headers.has(requestSignatureHeader)).toBe(false);
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
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("private internal detail")),
  );
  const response = await forwardApiRequest(
    new Request("http://localhost/api/post"),
  );
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "API unavailable" });
  const requestId = response.headers.get(requestIdHeader);
  expect(isRequestId(requestId)).toBe(true);
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
    event: "admin.upstream.failed",
    code: "transport",
    requestId,
  });
  expect(JSON.stringify(log.mock.calls)).not.toContain(
    "private internal detail",
  );
});

function rejectOnAbort(_url: URL, { signal }: RequestInit) {
  if (!signal) {
    throw new Error("Missing forwarding abort signal");
  }

  signal.throwIfAborted();

  return new Promise<Response>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
}

it("returns the existing 502 without logging a dependency failure on caller abort", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(rejectOnAbort));
  const caller = new AbortController();
  const pending = forwardApiRequest(
    new Request("http://localhost/api/post", { signal: caller.signal }),
  );
  caller.abort();

  const response = await pending;
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "API unavailable" });
  expect(isRequestId(response.headers.get(requestIdHeader))).toBe(true);
  expect(log).not.toHaveBeenCalled();
});

it("logs the deadline when it ends the fetch before a caller abort", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const deadline = new AbortController();
  const caller = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
  vi.stubGlobal("fetch", vi.fn(rejectOnAbort));
  const pending = forwardApiRequest(
    new Request("http://localhost/api/post", { signal: caller.signal }),
  );
  deadline.abort(new DOMException("Deadline expired", "TimeoutError"));
  caller.abort();

  const response = await pending;
  expect(response.status).toBe(502);
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
    event: "admin.upstream.failed",
    code: "timeout",
    requestId: response.headers.get(requestIdHeader),
  });
});

it("returns a safe correlated 502 for invalid origin configuration", async () => {
  vi.stubEnv(
    "API_INTERNAL_ORIGIN",
    "http://user:synthetic-private@api.invalid",
  );
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);

  const response = await forwardApiRequest(
    new Request("http://localhost/api/post"),
  );

  const requestId = response.headers.get(requestIdHeader);
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "API unavailable" });
  expect(isRequestId(requestId)).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
  expect(JSON.parse(log.mock.calls[0][0])).toEqual({
    timestamp: expect.any(String),
    service: "admin",
    event: "admin.upstream.failed",
    category: "operational",
    level: "error",
    outcome: "failure",
    operation: "forward",
    code: "configuration",
    status: 502,
    requestId,
  });
});

it("replaces browser IDs and signs the correlation ID sent to API", async () => {
  vi.stubEnv(
    "NEXTPRESS_REQUEST_CORRELATION_SECRET",
    "test-shared-correlation-key-at-least-32-bytes",
  );
  const browserId = newRequestId();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: URL, init: RequestInit) => {
      const outgoing = new Headers(init.headers);
      const verified = apiRequestId(outgoing);
      expect(verified).not.toBe(browserId);
      expect(verified).toBe(outgoing.get(requestIdHeader));

      return Response.json(
        { error: "Forbidden" },
        { status: 403, headers: { [requestIdHeader]: verified } },
      );
    }),
  );
  const response = await forwardApiRequest(
    new Request("http://localhost/api/post", {
      headers: {
        [requestIdHeader]: browserId,
        "x-nextpress-request-signature": "forged",
      },
    }),
  );
  expect(response.headers.get(requestIdHeader)).not.toBe(browserId);
  expect(isRequestId(response.headers.get(requestIdHeader))).toBe(true);
  expect(response.status).toBe(403);
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

it.each([
  ["/api/private-drafts/execute", "POST", 65000],
  ["/api/private-drafts/execute", "GET", 30000],
  ["/api/post", "POST", 30000],
  ["/api/private-drafts/execute/extra", "POST", 30000],
])(
  "bounds forwarding budget for %s %s",
  async (pathname, method, milliseconds) => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: URL, init: RequestInit) => {
        controller.abort();
        expect(init.signal?.aborted).toBe(true);

        return Response.json({ ok: true });
      }),
    );

    try {
      expect(
        (
          await forwardApiRequest(
            new Request(`http://localhost${pathname}`, {
              method,
              signal: controller.signal,
            }),
          )
        ).status,
      ).toBe(200);
      expect(timeout).toHaveBeenCalledWith(Number(milliseconds));
    } finally {
      timeout.mockRestore();
    }
  },
);
