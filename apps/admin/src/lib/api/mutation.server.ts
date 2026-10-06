import "server-only";

import { NextResponse } from "next/server";

import { forbid } from "./http";
import { getTrustedOrigins } from "@/lib/auth/origins.server";

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
