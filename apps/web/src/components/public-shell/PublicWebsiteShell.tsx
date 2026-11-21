import { PublicMenusSchema } from "@nextpress/shared/api-contracts";
import { cache } from "react";

import { fetchPublic } from "@/lib/content/public-api.server";
import { SiteDateTimeProvider } from "@/lib/i18n/client";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

import type { ReactNode } from "react";

const getPublicMenus = cache(() => fetchPublic("menus", PublicMenusSchema));

export async function PublicWebsiteShell({
  children,
}: {
  children: ReactNode;
}) {
  const [settings, navigation] = await Promise.all([
    getPublicSiteSettings(),
    getPublicMenus(),
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
