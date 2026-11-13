import { redirect } from "next/navigation";

import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";
import { parsePostsPage } from "@/lib/content/post-archive";
import { getPublishedPosts } from "@/lib/content/public-content.server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { contentMetadata } from "@/lib/settings/seo";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

export function generateMetadata() {
  return contentMetadata("Posts", "/posts");
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
    redirect("/posts");
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
