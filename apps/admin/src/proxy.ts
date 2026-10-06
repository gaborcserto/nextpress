import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";

import { adminContentSecurityPolicy } from "./lib/security/headers";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const policy = adminContentSecurityPolicy(
    nonce, process.env.NODE_ENV === "production", process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  );
  const requestHeaders = new Headers(request.headers);
  // Overwrite untrusted inbound CSP; only our nonce may authorize scripts.
  requestHeaders.set("Content-Security-Policy", policy);
  requestHeaders.delete("Content-Security-Policy-Report-Only");
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  // Include auth callbacks, errors, and prefetches so they retain protection.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
