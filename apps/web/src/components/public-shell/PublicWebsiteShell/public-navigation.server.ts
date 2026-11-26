import "server-only";

import { PublicMenusSchema } from "@nextpress/shared/api-contracts";
import { renderRequestId } from "@nextpress/shared/request-correlation";
import { writeServerLog } from "@nextpress/shared/server-logging";
import { headers } from "next/headers";
import { cache } from "react";

import { fetchPublic, PublicApiError } from "@/lib/content/public-api.server";

const getPublicMenus = cache(() => fetchPublic("menus", PublicMenusSchema));
const emptyPublicMenus = { header: [], footer: [], sidebar: [] };

export async function getNavigationForShell() {
  try {
    return await getPublicMenus();
  } catch (error) {
    if (!(error instanceof PublicApiError)) {
      throw error;
    }

    const requestId = renderRequestId(await headers());
    writeServerLog("web", "public.navigation.degraded", {
      requestId,
      operation: "public.content",
      code: error.code,
      status: error.status,
    });

    return emptyPublicMenus;
  }
}
