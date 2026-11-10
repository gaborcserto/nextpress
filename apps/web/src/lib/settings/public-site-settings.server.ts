import "server-only";

import { PublicSiteSettingsSchema } from "@nextpress/shared/api-contracts";
import { cache } from "react";

import { fetchPublic } from "../content/public-api.server";

import type { z } from "zod";

export type PublicSiteSettings = z.infer<typeof PublicSiteSettingsSchema>;
export const getPublicSiteSettings = cache(
  async (): Promise<PublicSiteSettings> => {
    return await fetchPublic("settings", PublicSiteSettingsSchema);
  },
);
