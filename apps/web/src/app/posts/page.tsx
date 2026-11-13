import { redirect } from "next/navigation";

import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";
import { parsePostsPage } from "@/lib/content/post-archive";
import { getPublishedPosts } from "@/lib/content/public-content.server";
import { messages } from "@/lib/i18n/messages";
import { localizedHref } from "@/lib/i18n/routing";
import { getLocale } from "@/lib/i18n/server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { contentMetadata } from "@/lib/settings/seo";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

export async function generateMetadata({ searchParams }: PostsPageProps) {
  const [query, settings, locale] = await Promise.all([
    searchParams,
    getPublicSiteSettings(),
    getLocale(),
  ]);
  const page = parsePostsPage(query.page, settings.postsPerPage);

  return contentMetadata(
    messages[locale].navigation.posts,
    page > 1 ? `/posts?page=${page}` : "/posts",
    undefined,
    locale,
  );
}

type PostsPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const { page: pageParam } = await searchParams;
  const settings = await getPublicSiteSettings();
  const page = parsePostsPage(pageParam, settings.postsPerPage);
  const { posts, hasMore } = await getPublishedPosts({
    limit: settings.postsPerPage,
    offset: (page - 1) * settings.postsPerPage,
  });

  if (page > 1 && posts.length === 0) {
    redirect(localizedHref("/posts", await getLocale()));
  }

  const appearance = resolveWebsiteAppearance(settings.appearance);
  const { Archive } = appearance.views;

  return (
    <PublicWebsiteShell>
      <Archive
        posts={posts}
        page={page}
        hasMore={hasMore}
        postsPerPage={settings.postsPerPage}
        listingMode={settings.postListingMode}
        listVariant={appearance.listVariant}
      />
    </PublicWebsiteShell>
  );
}
