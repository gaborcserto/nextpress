import { isLocale } from "./messages";

import type { Locale } from "./messages";

export const localeHeader = "x-nextpress-locale";

export function pathLocale(pathname: string): Locale | undefined {
  const segment = pathname.split("/")[1];

  return isLocale(segment) ? segment : undefined;
}

export function stripLocalePrefix(pathname: string): string {
  if (!pathLocale(pathname)) {
    return pathname;
  }

  return pathname.replace(/^\/(en|hu)(?=\/|$)/, "") || "/";
}

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    /^\/(posts|pages|tags|categories|search)(\/|$)/.test(pathname)
  );
}

/** Localize only known public routes; preserve external, media and preview URLs. */
export function localizedHref(href: string, locale: Locale): string {
  const [pathname = "", suffix = ""] = href.split(/(?=[?#])(.+)/, 2);
  const publicPath = stripLocalePrefix(pathname);

  if (!isPublicPath(publicPath)) {
    return href;
  }

  const normalizedPath =
    publicPath === "/" ? "/" : publicPath.replace(/\/+$/, "");

  return `/${locale}${normalizedPath}${suffix}`;
}
