import "server-only";

import type { z } from "zod";

export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: "upstream" | "transport" | "contract",
  ) {
    super("Public content is temporarily unavailable.");
    this.name = "PublicApiError";
  }
}

function apiOrigin(): string {
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
  try {
    const response = await fetch(`${apiOrigin()}/api/public/${path}`, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 404 && missingAllowed) return null;
    if (!response.ok) throw new PublicApiError(response.status, "upstream");
    const body: unknown = await response.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) throw new PublicApiError(502, "contract");

    return parsed.data;
  } catch (error) {
    if (error instanceof PublicApiError) throw error;
    throw new PublicApiError(503, "transport");
  }
}
