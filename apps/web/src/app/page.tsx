import { PublishedPage } from "@/components/public-content/PublishedPage";
import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";
import {
  getPublishedHome,
  getPublishedPosts,
  getPublishedTags,
} from "@/lib/content/public-content.server";
import { getLocale } from "@/lib/i18n/server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { contentMetadata } from "@/lib/settings/seo";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

export async function generateMetadata() {
  const home = await getPublishedHome();

  if (home) {
    return contentMetadata(home.title, "/", home.summary, await getLocale());
  }

  const settings = await getPublicSiteSettings();

  return contentMetadata(
    settings.siteName,
    "/",
    settings.siteDescription,
    await getLocale(),
  );
}

export default async function Home() {
  const [settings, home] = await Promise.all([
    getPublicSiteSettings(),
    getPublishedHome(),
  ]);

  if (home) {
    return <PublishedPage page={home} settings={settings} />;
  }

  const [latest, tagBatch] = await Promise.all([
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
