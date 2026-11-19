import {
  apiRequestId,
  isRequestId,
  requestIdHeader,
} from "@nextpress/shared/request-correlation";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { GET } from "./route";

const upstream = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", upstream);
  upstream.mockReset();
  vi.stubEnv("API_INTERNAL_ORIGIN", "http://api.test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("forwards public images without browser credentials", async () => {
  vi.stubEnv(
    "NEXTPRESS_REQUEST_CORRELATION_SECRET",
    "test-shared-correlation-key-at-least-32-bytes",
  );
  upstream.mockResolvedValue(
    new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { "Content-Type": "image/png" },
    }),
  );
  const response = await GET(
    new Request("http://web.test/media/image", {
      headers: { cookie: "private-session", authorization: "private-token" },
    }),
    { params: Promise.resolve({ id: "image" }) },
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  expect(upstream).toHaveBeenCalledWith(
    "http://api.test/api/public/media/image",
    expect.objectContaining({
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    }),
  );
  const sent = new Headers(upstream.mock.calls[0]?.[1].headers);
  const headerNames: string[] = [];
  sent.forEach((_value, name) => headerNames.push(name));
  const requestId = response.headers.get(requestIdHeader);
  expect(isRequestId(requestId)).toBe(true);
  expect(apiRequestId(sent)).toBe(requestId);
  expect(headerNames.sort()).toEqual([
    "x-nextpress-request-signature",
    requestIdHeader,
  ]);
});

it("fails closed for private media, path traversal and missing production configuration", async () => {
  upstream.mockResolvedValue(new Response(null, { status: 404 }));
  expect(
    (
      await GET(new Request("http://web.test/media/private"), {
        params: Promise.resolve({ id: "private" }),
      })
    ).status,
  ).toBe(404);
  upstream.mockClear();
  expect(
    (
      await GET(new Request("http://web.test/media/invalid"), {
        params: Promise.resolve({ id: "../private" }),
      })
    ).status,
  ).toBe(404);
  expect(upstream).not.toHaveBeenCalled();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("API_INTERNAL_ORIGIN", "");
  expect(
    (
      await GET(new Request("http://web.test/media/image"), {
        params: Promise.resolve({ id: "image" }),
      })
    ).status,
  ).toBe(503);
  expect(upstream).not.toHaveBeenCalled();
});
