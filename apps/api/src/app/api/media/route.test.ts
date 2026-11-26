import { maxImageUploadRequestBytes } from "@nextpress/shared/media";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadMedia, writeServerLog } = vi.hoisted(() => ({
  uploadMedia: vi.fn(),
  writeServerLog: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({
  withAuth:
    (
      _roles: string[],
      handler: (
        ...args: [
          Request,
          { params: Promise<Record<string, string>> },
          { session: { user: { id: string; role: "EDITOR" } } },
        ]
      ) => Promise<Response> | Response,
      _limit: unknown,
      type: string,
    ) =>
    async (request: Request) => {
      if (request.headers.get("origin") !== "http://localhost") {
        return Response.json(
          { error: "Untrusted request origin" },
          { status: 403 },
        );
      }

      if (request.headers.get("content-type") !== type) {
        return Response.json(
          { error: "Invalid content type" },
          { status: 415 },
        );
      }

      return handler(
        request,
        { params: Promise.resolve({}) },
        {
          session: { user: { id: "editor", role: "EDITOR" } },
        },
      );
    },
}));
vi.mock("@/lib/api/request-log-context.server", () => ({
  apiLogContext: () => ({}),
}));
vi.mock("@nextpress/shared/server-logging", () => ({ writeServerLog }));
vi.mock("@/lib/services/media.server", () => ({
  listMedia: vi.fn(),
  uploadMedia,
  MediaValidationError: class extends Error {},
  MediaBusyError: class extends Error {},
}));
vi.mock("@/lib/services/media-image.server", () => ({
  UnsupportedMediaAnimationError: class extends Error {},
}));

import { POST } from "./route";

function request(
  body: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost/api/media", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      ...headers,
    },
    body,
    duplex: "half",
  } as RequestInit);
}

function jsonStream(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  uploadMedia.mockResolvedValue({ id: "media-id" });
});

describe("POST /api/media request body", () => {
  it("sends a valid parsed request to the existing upload service", async () => {
    const payload = { data: "aGVsbG8=", mime: "image/png", alt: null };
    const response = await POST(request(jsonStream(payload)), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(201);
    expect(uploadMedia).toHaveBeenCalledWith(payload, {
      id: "editor",
      role: "EDITOR",
    });
  });

  it("rejects a declared oversized body without invoking upload", async () => {
    const response = await POST(
      request(jsonStream({}), {
        "content-length": String(maxImageUploadRequestBytes + 1),
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Image upload too large" });
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it("retains origin protection before reading request content", async () => {
    const response = await POST(
      request(jsonStream({}), { origin: "https://untrusted.example" }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(403);
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it("returns generic malformed-body errors and never uploads", async () => {
    const response = await POST(
      request(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("{"));
            controller.close();
          },
        }),
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid image upload" });
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it("returns timeout status without invoking upload", async () => {
    vi.useFakeTimers();
    const responsePromise = POST(request(new ReadableStream<Uint8Array>()), {
      params: Promise.resolve({}),
    });
    const responseResult = expect(responsePromise).resolves.toBeDefined();
    await vi.advanceTimersByTimeAsync(15_000);
    await responseResult;
    const response = await responsePromise;

    expect(response.status).toBe(408);
    expect(await response.json()).toEqual({ error: "Image upload timed out" });
    expect(uploadMedia).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
