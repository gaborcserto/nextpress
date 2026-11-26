import { SiteDateTimeProvider } from "@/lib/i18n/client";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

import { getNavigationForShell } from "./public-navigation.server";

import type { ReactNode } from "react";

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
