import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";
import {
  getPublishedPosts,
  getPublishedTags,
} from "@/lib/content/public-content.server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { contentMetadata } from "@/lib/settings/seo";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

export async function generateMetadata() {
  const settings = await getPublicSiteSettings();

  return contentMetadata(settings.siteName, "/", settings.siteDescription);
}

export default async function Home() {
  const [settings, latest, tagBatch] = await Promise.all([
    getPublicSiteSettings(),
    getPublishedPosts({ limit: 5 }),
    getPublishedTags({ limit: 12 }),
  ]);

  const appearance = resolveWebsiteAppearance(settings.appearance);
  const { Home } = appearance.views;

  return (
    <PublicWebsiteShell>
      <Home
        siteName={settings.siteName}
        siteDescription={settings.siteDescription}
        posts={latest.posts}
        tagBatch={tagBatch}
        listVariant={appearance.listVariant}
      />
    </PublicWebsiteShell>
  );
}
