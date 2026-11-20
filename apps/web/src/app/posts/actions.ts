"use server";

import { getMaxPostsPage } from "@/lib/content/post-archive";
import {
  getPagePosts,
  getPublishedPage,
  getPublishedPosts,
} from "@/lib/content/public-content.server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";

export async function getNextPostBatch(page: number, pageSlug?: string) {
  const settings = await getPublicSiteSettings();

  if (
    settings.postListingMode !== "LOAD_MORE" ||
    !Number.isSafeInteger(page) ||
    page < 2 ||
    page > getMaxPostsPage(settings.postsPerPage)
  ) {
    return null;
  }

  const limit = settings.postsPerPage;
  const offset = (page - 1) * limit;

  if (pageSlug !== undefined) {
    if (typeof pageSlug !== "string") {
      return null;
    }

    const listing = await getPublishedPage(pageSlug);

    return listing?.pageType === "posts"
      ? getPagePosts(listing, limit, offset)
      : null;
  }

  return getPublishedPosts({ limit, offset });
}
