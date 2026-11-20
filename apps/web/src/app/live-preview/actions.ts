"use server";

import { PublicContentIndexQuerySchema } from "@nextpress/shared/api-contracts";
import { ContentSlugSchema } from "@nextpress/shared/content";

import { getDocumentListing } from "@/lib/content/document-listing.server";
import { getMaxPostsPage } from "@/lib/content/post-archive";
import { getPagePosts } from "@/lib/content/public-content.server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";

// Only public discovery parameters cross this boundary. Preview snapshots stay in the browser.
export async function getPreviewPosts(page: number, tag: string | null) {
  const filter = ContentSlugSchema.safeParse(tag);
  const { postsPerPage } = await getPublicSiteSettings();

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > getMaxPostsPage(postsPerPage) ||
    (tag !== null && !filter.success)
  ) {
    return null;
  }

  return getPagePosts(
    {
      postsFilter: filter.success
        ? { type: "TAG", slug: filter.data }
        : undefined,
    },
    postsPerPage,
    (page - 1) * postsPerPage,
  );
}

export async function getPreviewDocumentListing(input: unknown) {
  const parsed = PublicContentIndexQuerySchema.safeParse(input);

  if (!parsed.success || !parsed.data.kind) {
    return [];
  }

  const { kind, limit, taxonomyId } = parsed.data;
  const { items } = await getDocumentListing({ kind, limit, taxonomyId });

  return items;
}
