import { PageDocument } from "@/components/PageDocument";
import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

import { GalleryEmpty } from "./GalleryEmpty";

import type { PublicPublishedPage } from "@/lib/content/public-content.server";
import type { PublicSiteSettings } from "@/lib/settings/public-site-settings.server";

export function PublishedPage({
  page,
  settings,
}: {
  page: PublicPublishedPage;
  settings: PublicSiteSettings;
}) {
  const { Page } = resolveWebsiteAppearance(settings.appearance).views;

  return (
    <PublicWebsiteShell>
      <Page content={page}>
        {page.pageDocument && <PageDocument document={page.pageDocument} />}
        {page.pageType === "gallery" && <GalleryEmpty />}
      </Page>
    </PublicWebsiteShell>
  );
}
