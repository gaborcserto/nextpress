import "server-only";

import { prisma } from "@nextpress/db/src/client";

import { isRole, type RoleName } from "@/lib/auth/roles";

export const SITE_SETTINGS_ID = "default";
export const FALLBACK_USER_ROLE: RoleName = "SUBSCRIBER";

export async function getDefaultUserRole(): Promise<RoleName> {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: SITE_SETTINGS_ID },
    select: { defaultUserRole: true },
  });

  return isRole(settings?.defaultUserRole)
    ? settings.defaultUserRole
    : FALLBACK_USER_ROLE;
}
