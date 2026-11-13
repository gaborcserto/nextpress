import { redirect } from "next/navigation";

import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";
import { parsePostsPage } from "@/lib/content/post-archive";
import { getPublishedTags } from "@/lib/content/public-content.server";
import { messages } from "@/lib/i18n/messages";
import { localizedHref } from "@/lib/i18n/routing";
import { getLocale } from "@/lib/i18n/server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { contentMetadata } from "@/lib/settings/seo";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

const TAGS_PER_PAGE = 30;
type TagsPageProps = { searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata({ searchParams }: TagsPageProps) {
  const page = parsePostsPage((await searchParams).page, TAGS_PER_PAGE);

  return contentMetadata(
    messages[await getLocale()].taxonomy.tags,
    page > 1 ? `/tags?page=${page}` : "/tags",
    undefined,
    await getLocale(),
  );
}

export default async function TagsPage({ searchParams }: TagsPageProps) {
  const page = parsePostsPage((await searchParams).page, TAGS_PER_PAGE);
  const [batch, settings] = await Promise.all([
    getPublishedTags({
      limit: TAGS_PER_PAGE,
      offset: (page - 1) * TAGS_PER_PAGE,
    }),
    getPublicSiteSettings(),
  ]);

  if (page > 1 && batch.tags.length === 0) {
    redirect(localizedHref("/tags", await getLocale()));
  }

  const { Tags } = resolveWebsiteAppearance(settings.appearance).views;

  return (
    <PublicWebsiteShell>
      <Tags {...batch} page={page} tagsPerPage={TAGS_PER_PAGE} />
    </PublicWebsiteShell>
  );
}
