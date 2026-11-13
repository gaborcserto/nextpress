import { getPublicPageNavigation } from "@/lib/content/public-content.server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

import type { ReactNode } from "react";

export async function PublicWebsiteShell({
  children,
}: {
  children: ReactNode;
}) {
  const [settings, navigation] = await Promise.all([
    getPublicSiteSettings(),
    getPublicPageNavigation(),
  ]);
  const { Shell } = resolveWebsiteAppearance(settings.appearance).views;

  return (
    <Shell
      siteName={settings.siteName}
      headerPages={navigation.header}
      footerPages={navigation.footer}
    >
      {children}
    </Shell>
  );
}
