import "server-only";

import { prisma, type Prisma } from "@nextpress/db";
import {
  DEFAULT_POST_LISTING_MODE,
  normalizeAppearance,
  PostListingModeSchema,
  normalizePostsPerPage,
} from "@nextpress/shared";

import type { PublicSiteSettingsSchema } from "@nextpress/shared/api-contracts";
import type { z } from "zod";

type PublicSiteSettings = z.infer<typeof PublicSiteSettingsSchema>;

const publicSiteSettingsSelect = {
  websiteTemplate: true,
  stylePreset: true,
  colorMode: true,
  siteName: true,
  siteDescription: true,
  postListingMode: true,
  postsPerPage: true,
} satisfies Prisma.SiteSettingsSelect;

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "default" },
    select: publicSiteSettingsSelect,
  });

  const postListingMode = PostListingModeSchema.safeParse(
    settings?.postListingMode,
  );
  return {
    appearance: normalizeAppearance(
      settings && {
        websiteTemplate: settings.websiteTemplate,
        stylePreset: settings.stylePreset,
        colorMode: settings.colorMode,
      },
    ),
    siteName: settings?.siteName.trim() || "NextPress",
    siteDescription:
      settings?.siteDescription?.trim() ||
      "A publication powered by NextPress.",
    postListingMode: postListingMode.success
      ? postListingMode.data
      : DEFAULT_POST_LISTING_MODE,
    postsPerPage: normalizePostsPerPage(settings?.postsPerPage),
  };
}
