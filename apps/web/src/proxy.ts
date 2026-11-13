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
  matcher: [
    "/",
    "/:locale(en|hu)/:path*",
    "/:section(posts|pages|tags|categories|search)/:path*",
  ],
};

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const locale = pathLocale(pathname);
  const publicPath = stripLocalePrefix(pathname);
  const requestHeaders = new Headers(request.headers);
  // Never accept a caller-supplied locale header as routing authority.
  requestHeaders.set(localeHeader, locale ?? "en");

  if (!isPublicPath(publicPath)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const canonicalPath = localizedHref(publicPath, locale ?? "en");

  if (!locale || pathname !== canonicalPath) {
    const destination = new URL(request.url);
    destination.pathname = canonicalPath;

    return NextResponse.redirect(destination, 308);
  }

  const destination = new URL(request.url);
  destination.pathname = publicPath;

  return NextResponse.rewrite(destination, {
    request: { headers: requestHeaders },
  });
}
