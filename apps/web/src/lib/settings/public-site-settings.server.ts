import "server-only";

import { prisma, type Prisma } from "@nextpress/db";
import { cache } from "react";

export type PublicSiteSettings = {
  siteName: string;
  siteDescription: string;
};

const publicSiteSettingsSelect = {
  siteName: true,
  siteDescription: true,
} satisfies Prisma.SiteSettingsSelect;

export const getPublicSiteSettings = cache(async (): Promise<PublicSiteSettings> => {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "default" },
    select: publicSiteSettingsSelect,
  });

  return {
    siteName: settings?.siteName.trim() || "NextPress",
    siteDescription: settings?.siteDescription?.trim() || "A publication powered by NextPress.",
  };
});
