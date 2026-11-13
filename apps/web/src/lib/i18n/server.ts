import "server-only";
import { headers } from "next/headers";

import { isLocale } from "./messages";
import { localeHeader } from "./routing";

export async function getLocale() {
  const requestHeaders = await headers();
  const locale = requestHeaders.get(localeHeader);

  return isLocale(locale) ? locale : "en";
}
