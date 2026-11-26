import "server-only";

export class ImageRequestBodyError extends Error {
  constructor(readonly status: 400 | 408 | 413) {
    super("Invalid image request body");
  }
}

export async function readBoundedJson(
  request: Request,
  maxBytes: number,
  timeoutMs: number,
) {
  const declaredLength = request.headers.get("content-length");

  if (/^\d+$/.test(declaredLength ?? "") && Number(declaredLength) > maxBytes) {
    throw new ImageRequestBodyError(413);
  }

  if (request.signal.aborted) {
    throw new ImageRequestBodyError(400);
  }

  const reader = request.body?.getReader();

  if (!reader) {
    throw new ImageRequestBodyError(400);
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectAbort: ((error: ImageRequestBodyError) => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ImageRequestBodyError(408)), timeoutMs);
  });
  const abort = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });

  const onAbort = () => rejectAbort?.(new ImageRequestBodyError(400));
  request.signal.addEventListener("abort", onAbort, { once: true });

  try {
    while (true) {
      const { done, value } = await Promise.race([
        reader.read(),
        timeout,
        abort,
      ]);

      if (done) {
        break;
      }

      size += value.byteLength;

      if (size > maxBytes) {
        throw new ImageRequestBodyError(413);
      }

      chunks.push(value);
    }

    const bytes = Buffer.concat(chunks, size);

    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof ImageRequestBodyError) {
      throw error;
    }

    throw new ImageRequestBodyError(400);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }

    request.signal.removeEventListener("abort", onAbort);
    void reader.cancel().catch(() => undefined);

    try {
      reader.releaseLock();
    } catch {
      // Cancellation has already been requested; a nonconforming stream may retain a read.
    }
  }
}
