import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const requestIdHeader = "x-request-id";
export const renderRequestIdHeader = "x-nextpress-render-id";
export const requestSignatureHeader = "x-nextpress-request-signature";
const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isRequestId(value: unknown): value is string {
  return typeof value === "string" && value.length === 36 && uuidV4.test(value);
}

export function newRequestId(): string {
  return randomUUID();
}

export function renderRequestId(headers: Headers): string {
  const id = headers.get(renderRequestIdHeader);

  return isRequestId(id) ? id : newRequestId();
}

function signRequestId(id: string): Buffer | undefined {
  const secret = process.env.NEXTPRESS_REQUEST_CORRELATION_SECRET;

  if (secret && Buffer.byteLength(secret) >= 32) {
    return createHmac("sha256", secret)
      .update(`nextpress.request-id.v1:${id}`)
      .digest();
  }
}

export function setUpstreamRequestId(headers: Headers, id: string): void {
  const signature = signRequestId(id);
  headers.set(requestIdHeader, id);

  if (signature) {
    headers.set(requestSignatureHeader, signature.toString("hex"));
  }
}

export function apiRequestId(headers: Headers): string {
  const id = headers.get(requestIdHeader);
  const signature = headers.get(requestSignatureHeader);

  if (
    isRequestId(id) &&
    signature?.length === 64 &&
    /^[a-f0-9]{64}$/.test(signature)
  ) {
    const expected = signRequestId(id);

    if (expected && timingSafeEqual(expected, Buffer.from(signature, "hex"))) {
      return id;
    }
  }

  return newRequestId();
}

export function responseRequestId(headers: Headers, fallback: string): string {
  const id = headers.get(requestIdHeader);

  return isRequestId(id) ? id : fallback;
}
