import "server-only";

import { prisma, type Prisma } from "@nextpress/db";
import {
  DEFAULT_POST_LISTING_MODE,
  PostListingModeSchema,
  normalizePostsPerPage,
} from "@nextpress/shared";
import { cache } from "react";

export type PublicSiteSettings = {
  siteName: string;
  siteDescription: string;
  postListingMode: "PAGINATION" | "LOAD_MORE";
  postsPerPage: number;
};

const publicSiteSettingsSelect = {
  siteName: true,
  siteDescription: true,
  postListingMode: true,
  postsPerPage: true,
} satisfies Prisma.SiteSettingsSelect;

export const getPublicSiteSettings = cache(async (): Promise<PublicSiteSettings> => {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "default" },
    select: publicSiteSettingsSelect,
  });

  const postListingMode = PostListingModeSchema.safeParse(settings?.postListingMode);
  return {
    siteName: settings?.siteName.trim() || "NextPress",
    siteDescription: settings?.siteDescription?.trim() || "A publication powered by NextPress.",
    postListingMode: postListingMode.success ? postListingMode.data : DEFAULT_POST_LISTING_MODE,
    postsPerPage: normalizePostsPerPage(settings?.postsPerPage),
  };
});
