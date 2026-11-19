import {
  newRequestId,
  renderRequestIdHeader,
  requestIdHeader,
} from "@nextpress/shared/request-correlation";
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";

import { adminContentSecurityPolicy } from "./lib/security/headers";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const policy = adminContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "production",
    undefined,
    request.nextUrl.pathname === "/api-docs" ||
      request.nextUrl.pathname.startsWith("/api-docs/"),
  );
  const requestHeaders = new Headers(request.headers);
  const requestId = newRequestId();
  requestHeaders.set(renderRequestIdHeader, requestId);
  // Overwrite untrusted inbound CSP; only our nonce may authorize scripts.
  requestHeaders.set("Content-Security-Policy", policy);
  requestHeaders.delete("Content-Security-Policy-Report-Only");
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);

  if (!/^\/(api|api-docs)\//.test(request.nextUrl.pathname)) {
    response.headers.set(requestIdHeader, requestId);
  }

  return response;
}

export const config = {
  // Include auth callbacks, errors, and prefetches so they retain protection.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
