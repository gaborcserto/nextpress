import { afterEach, expect, it, vi } from "vitest";

import { requestPreviewMedia } from "./request-preview-media";

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = "";
});

it("accepts preview image bytes only from the configured host and matching request", async () => {
  const origin = "https://admin.example.invalid";
  const session = "11111111-1111-4111-8111-111111111111";
  const host = { postMessage: vi.fn() };
  vi.stubGlobal("opener", host);
  window.location.hash = session;
  const abort = new AbortController();
  const accepted = Uint8Array.of(137, 80, 78, 71).buffer;

  const result = requestPreviewMedia(origin, "image", abort.signal);
  const [request, recipient] = host.postMessage.mock.calls[0];
  expect(recipient).toBe(origin);

  function send(payload: object, from: string, source: object) {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: from,
        source: source as Window,
        data: {
          ...request,
          type: "nextpress:media-response",
          ...payload,
        },
      }),
    );
  }

  send({ bytes: null }, "https://example.invalid", host);
  send({ bytes: null }, origin, window);
  send({ bytes: null, id: "another-image" }, origin, host);
  send({ bytes: accepted }, origin, host);

  await expect(result).resolves.toEqual(accepted);
});
