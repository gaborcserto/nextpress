import "server-only";

import {
  renderRequestId,
  responseRequestId,
  setUpstreamRequestId,
} from "@nextpress/shared/request-correlation";
import { writeServerLog } from "@nextpress/shared/server-logging";
import {
  isUnavailableResponse,
  serviceUnavailableDigest,
} from "@nextpress/shared/service-unavailable";
import { headers } from "next/headers";

import type { z } from "zod";

export class PublicApiError extends Error {
  readonly digest?: string;

  constructor(
    public readonly status: number,
    public readonly code: "upstream" | "transport" | "contract",
  ) {
    super("Public content is temporarily unavailable.");
    this.name = "PublicApiError";

    if (status === 503) {
      this.digest = serviceUnavailableDigest();
    }
  }
}

export function publicApiOrigin(): string {
  const configured = process.env.API_INTERNAL_ORIGIN;

  if (!configured && process.env.NODE_ENV === "production") {
    throw new PublicApiError(503, "transport");
  }

  const origin = new URL(configured || "http://localhost:49102");

  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new PublicApiError(503, "transport");
  }

  return origin.origin;
}

export function fetchPublic<T>(path: string, schema: z.ZodType<T>): Promise<T>;
export function fetchPublic<T>(
  path: string,
  schema: z.ZodType<T>,
  missingAllowed: true,
): Promise<T | null>;
export async function fetchPublic<T>(
  path: string,
  schema: z.ZodType<T>,
  missingAllowed = false,
): Promise<T | null> {
  const requestId = renderRequestId(await headers());
  const outgoing = new Headers({ Accept: "application/json" });
  setUpstreamRequestId(outgoing, requestId);
  let correlationId = requestId;

  try {
    const response = await fetch(`${publicApiOrigin()}/api/public/${path}`, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      headers: outgoing,
      signal: AbortSignal.timeout(10_000),
    });
    correlationId = responseRequestId(response.headers, requestId);

    if (response.status === 404 && missingAllowed) {
      return null;
    }

    if (!response.ok) {
      throw new PublicApiError(
        isUnavailableResponse(response) ? 503 : response.status,
        "upstream",
      );
    }

    const body: unknown = await response.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      throw new PublicApiError(502, "contract");
    }

    return parsed.data;
  } catch (error) {
    const failure =
      error instanceof PublicApiError
        ? error
        : new PublicApiError(503, "transport");
    writeServerLog("web", "public.upstream.failed", {
      requestId,
      upstreamRequestId: correlationId,
      operation: "public.content",
      code: failure.code,
      status: failure.status,
    });
    throw failure;
  }
}
