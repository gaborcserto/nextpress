import {
  maxImageUploadRequestBytes,
  maxMediaUploadBytes,
  MediaUploadSchema,
} from "@nextpress/shared/media";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ImageRequestBodyError,
  readBoundedJson,
} from "./image-request-body.server";

const timeoutMs = 15_000;

function streamRequest(
  chunks: Uint8Array[],
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost/api/media", {
    method: "POST",
    headers,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }

        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("bounded image request JSON reader", () => {
  it("accepts the maximum decoded Admin upload and escaped filename metadata", async () => {
    const input = {
      data: Buffer.alloc(maxMediaUploadBytes).toString("base64"),
      mime: "image/jpeg",
      alt: null,
      filename: "\u0000".repeat(255),
    };
    const serialized = JSON.stringify(input);

    expect(MediaUploadSchema.safeParse(input).success).toBe(true);
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(
      maxImageUploadRequestBytes,
    );
    await expect(
      readBoundedJson(
        streamRequest([new TextEncoder().encode(serialized)]),
        maxImageUploadRequestBytes,
        timeoutMs,
      ),
    ).resolves.toEqual(input);
  });

  it("accepts an exact byte budget and counts UTF-8 transport bytes", async () => {
    const prefix = JSON.stringify({ value: "é" });
    const prefixBytes = new TextEncoder().encode(prefix).byteLength;
    const exact = `${prefix}${" ".repeat(maxImageUploadRequestBytes - prefixBytes)}`;
    const bytes = new TextEncoder().encode(exact);

    expect(bytes.byteLength).toBe(maxImageUploadRequestBytes);
    await expect(
      readBoundedJson(
        streamRequest([bytes]),
        maxImageUploadRequestBytes,
        timeoutMs,
      ),
    ).resolves.toEqual({ value: "é" });
  });

  it("cancels and eventually releases the reader after a successful read", async () => {
    const request = streamRequest([new TextEncoder().encode('{"ok":true}')]);
    const removeListener = vi.spyOn(request.signal, "removeEventListener");

    await expect(
      readBoundedJson(request, maxImageUploadRequestBytes, timeoutMs),
    ).resolves.toEqual({ ok: true });
    await vi.waitFor(() => expect(request.body?.locked).toBe(false));
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("rejects actual overflow across chunks despite misleading Content-Length", async () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ value: "x" }).padEnd(
        maxImageUploadRequestBytes + 1,
        " ",
      ),
    );

    await expect(
      readBoundedJson(
        streamRequest(
          [bytes.subarray(0, 1_000_000), bytes.subarray(1_000_000)],
          { "content-length": "1" },
        ),
        maxImageUploadRequestBytes,
        timeoutMs,
      ),
    ).rejects.toMatchObject({ status: 413 });
  });

  it("rejects declared overflow before acquiring a reader", async () => {
    const request = new Request("http://localhost/api/media", {
      method: "POST",
      headers: { "content-length": String(maxImageUploadRequestBytes + 1) },
      body: new ReadableStream(),
      duplex: "half",
    } as RequestInit);
    const body = request.body;
    const getReader = vi.spyOn(body!, "getReader");

    await expect(
      readBoundedJson(request, maxImageUploadRequestBytes, timeoutMs),
    ).rejects.toMatchObject({ status: 413 });
    expect(getReader).not.toHaveBeenCalled();
  });

  it.each([undefined, "bad", "-2"])(
    "streams safely with Content-Length %s",
    async (length) => {
      const headers: Record<string, string> =
        length === undefined ? {} : { "content-length": length };
      await expect(
        readBoundedJson(
          streamRequest([new TextEncoder().encode('{"ok":true}')], headers),
          maxImageUploadRequestBytes,
          timeoutMs,
        ),
      ).resolves.toEqual({ ok: true });
    },
  );

  it.each([
    { name: "empty", chunks: [] },
    { name: "truncated JSON", chunks: [new TextEncoder().encode("{")] },
    { name: "invalid UTF-8", chunks: [new Uint8Array([0xff])] },
  ])("maps $name bodies to 400", async ({ chunks }) => {
    await expect(
      readBoundedJson(
        streamRequest(chunks),
        maxImageUploadRequestBytes,
        timeoutMs,
      ),
    ).rejects.toBeInstanceOf(ImageRequestBodyError);
  });

  it("returns at deadline even if cancellation never settles", async () => {
    vi.useFakeTimers();
    const request = new Request("http://localhost/api/media", {
      method: "POST",
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("{"));
        },
        cancel() {
          return new Promise<void>(() => {});
        },
      }),
      duplex: "half",
    } as RequestInit);
    const removeListener = vi.spyOn(request.signal, "removeEventListener");
    const pending = readBoundedJson(
      request,
      maxImageUploadRequestBytes,
      timeoutMs,
    );
    const rejection = expect(pending).rejects.toMatchObject({ status: 408 });

    await vi.advanceTimersByTimeAsync(timeoutMs);
    await rejection;
    expect(request.body?.locked).toBe(false);
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("rejects cancellation while waiting for a stream chunk", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/media", {
      method: "POST",
      signal: controller.signal,
      body: new ReadableStream<Uint8Array>(),
      duplex: "half",
    } as RequestInit);
    const pending = readBoundedJson(
      request,
      maxImageUploadRequestBytes,
      timeoutMs,
    );

    controller.abort();
    await expect(pending).rejects.toMatchObject({ status: 400 });
  });

  it("maps stream read failures to a generic 400", async () => {
    const request = new Request("http://localhost/api/media", {
      method: "POST",
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error("synthetic stream failure"));
        },
      }),
      duplex: "half",
    } as RequestInit);

    await expect(
      readBoundedJson(request, maxImageUploadRequestBytes, timeoutMs),
    ).rejects.toMatchObject({
      status: 400,
      message: "Invalid image request body",
    });
  });
});
