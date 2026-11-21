import { PreviewMediaResponseSchema } from "@nextpress/shared/revisions";

export function requestPreviewMedia(
  adminOrigin: string,
  id: string,
  signal: AbortSignal,
) {
  const host =
    window.opener ?? (window.parent !== window ? window.parent : null);

  if (!host || signal.aborted) {
    return Promise.resolve(null);
  }

  const session = window.location.hash.slice(1);
  const requestId = crypto.randomUUID();

  return new Promise<ArrayBuffer | null>((resolve) => {
    const timeout = window.setTimeout(cancel, 15_000);
    window.addEventListener("message", receive);
    signal.addEventListener("abort", cancel, { once: true });
    host.postMessage(
      { type: "nextpress:media-request", session, id, requestId },
      adminOrigin,
    );

    function receive(event: MessageEvent) {
      if (event.origin !== adminOrigin || event.source !== host) {
        return;
      }

      const result = PreviewMediaResponseSchema.safeParse(event.data);

      if (
        result.success &&
        result.data.session === session &&
        result.data.id === id &&
        result.data.requestId === requestId
      ) {
        finish(result.data.bytes);
      }
    }

    function cancel() {
      finish(null);
    }

    function finish(bytes: ArrayBuffer | null) {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      signal.removeEventListener("abort", cancel);
      resolve(bytes);
    }
  });
}
