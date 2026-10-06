"use server";

import { getMaxPostsPage } from "@/lib/content/post-archive";
import { getPublishedPosts } from "@/lib/content/public-content.server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";

export async function getNextPostBatch(page: number) {
  const settings = await getPublicSiteSettings();
  if (settings.postListingMode !== "LOAD_MORE"
    || !Number.isSafeInteger(page)
    || page < 2
    || page > getMaxPostsPage(settings.postsPerPage)) {
    return null;
  }

  return getPublishedPosts({
    limit: settings.postsPerPage,
    offset: (page - 1) * settings.postsPerPage,
  });
}
