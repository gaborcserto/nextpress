import {
  newRequestId,
  renderRequestIdHeader,
  requestIdHeader,
} from "@nextpress/shared/request-correlation";
import { NextResponse } from "next/server";

import {
  isPublicPath,
  localizedHref,
  localeHeader,
  pathLocale,
  stripLocalePrefix,
} from "./lib/i18n/routing";

import type { NextRequest } from "next/server";

export const config = {
  // Shared layouts and the sitemap also make API requests outside localized routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const locale = pathLocale(pathname);
  const publicPath = stripLocalePrefix(pathname);
  const requestHeaders = new Headers(request.headers);
  const requestId = newRequestId();
  requestHeaders.set(renderRequestIdHeader, requestId);
  // Never accept a caller-supplied locale header as routing authority.
  requestHeaders.set(localeHeader, locale ?? "en");

  if (!isPublicPath(publicPath)) {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set(requestIdHeader, requestId);

    return response;
  }

  const canonicalPath = localizedHref(publicPath, locale ?? "en");

  if (!locale || pathname !== canonicalPath) {
    const destination = new URL(request.url);
    destination.pathname = canonicalPath;

    const response = NextResponse.redirect(destination, 308);
    response.headers.set(requestIdHeader, requestId);

    return response;
  }

  const destination = new URL(request.url);
  destination.pathname = publicPath;

  const response = NextResponse.rewrite(destination, {
    request: { headers: requestHeaders },
  });
  response.headers.set(requestIdHeader, requestId);

  return response;
}
