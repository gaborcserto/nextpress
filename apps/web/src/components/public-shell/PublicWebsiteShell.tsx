import { PublicMenusSchema } from "@nextpress/shared/api-contracts";
import { renderRequestId } from "@nextpress/shared/request-correlation";
import { writeServerLog } from "@nextpress/shared/server-logging";
import { headers } from "next/headers";
import { cache } from "react";

import { fetchPublic, PublicApiError } from "@/lib/content/public-api.server";
import { SiteDateTimeProvider } from "@/lib/i18n/client";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

import type { ReactNode } from "react";

const getPublicMenus = cache(() => fetchPublic("menus", PublicMenusSchema));
const emptyPublicMenus = { header: [], footer: [], sidebar: [] };

async function getNavigationForShell() {
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

export async function PublicWebsiteShell({
  children,
}: {
  children: ReactNode;
}) {
  const [settings, navigation] = await Promise.all([
    getPublicSiteSettings(),
    getNavigationForShell(),
  ]);

  const appearance = resolveWebsiteAppearance(settings.appearance);
  const { Shell } = appearance.views;

  return (
    <Shell
      siteName={settings.siteName}
      menus={navigation}
      supportsSidebar={appearance.navigation.sidebar}
    >
      <SiteDateTimeProvider settings={settings.dateTime}>
        {children}
      </SiteDateTimeProvider>
    </Shell>
  );
}
