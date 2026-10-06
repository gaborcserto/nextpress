import "server-only";

import { NextResponse } from "next/server";

import { forbid } from "./http";
import { getTrustedOrigins } from "@/lib/auth/origins.server";

export const MAX_MUTATION_BODY_BYTES = 5_000_000;

export async function readBoundedMutationRequest(req: Request): Promise<{ request?: Request; response?: Response }> {
  if (!req.body) return { request: req };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_MUTATION_BODY_BYTES) {
      await reader.cancel();
      return { response: NextResponse.json({ error: "Request body is too large" }, { status: 413 }) };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { request: new Request(req.url, { method: req.method, headers: req.headers, body }) };
}

/** Custom cookie-authenticated routes must check this before session lookup. */
export function requireTrustedMutation(req: Request): Response | null {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return null;

  const origin = req.headers.get("origin");
  // Compare serialized origins, not URL prefixes or client-controlled Host /
  // forwarded headers. Missing Origin has no browser or server exception.
  if (!origin || !getTrustedOrigins().includes(origin)) return forbid("Untrusted request origin");

  const contentType = req.headers.get("content-type");
  const needsJSON = ["POST", "PUT", "PATCH"].includes(req.method) || req.body !== null || contentType !== null;
  if (needsJSON && contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  return null;
}
