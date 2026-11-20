import "server-only";

import { PublicSiteSettingsSchema } from "@nextpress/shared/api-contracts";
import { cache } from "react";

import { fetchPublic, PublicApiError } from "../content/public-api.server";

import type { z } from "zod";

export type PublicSiteSettings = z.infer<typeof PublicSiteSettingsSchema>;
export const getPublicSiteSettings = cache(
  async (): Promise<PublicSiteSettings> => {
    return await fetchPublic("settings", PublicSiteSettingsSchema);
  },
);

export async function getPublicSiteSettingsForLayout(): Promise<PublicSiteSettings> {
  try {
    return await getPublicSiteSettings();
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 503) {
      return {
        siteName: "NextPress",
        siteDescription: "A publication powered by NextPress.",
        postListingMode: "PAGINATION",
        postsPerPage: 10,
      };
    }

    throw error;
  }
}
