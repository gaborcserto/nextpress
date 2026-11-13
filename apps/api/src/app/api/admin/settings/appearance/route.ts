import { prisma } from "@nextpress/db";
import { AppearanceSchema, normalizeAppearance } from "@nextpress/shared";

import { bad, ok, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import { SITE_SETTINGS_ID } from "@/lib/settings/site-settings";

export const runtime = "nodejs";
const select = {
  websiteTemplate: true,
  stylePreset: true,
  colorMode: true,
} as const;

export const GET = withAuth(["ADMIN"], async () => {
  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: SITE_SETTINGS_ID },
      select,
    });

    return ok(normalizeAppearance(settings));
  } catch {
    console.error("GET /api/admin/settings/appearance failed");

    return oops();
  }
});

export const PUT = withAuth(
  ["ADMIN"],
  async (req) => {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON");
    }

    const parsed = AppearanceSchema.safeParse(body);

    if (!parsed.success) {
      return bad("Invalid appearance payload");
    }

    const { websiteTemplate, stylePreset, colorMode } = parsed.data;
    const data = { websiteTemplate, stylePreset, colorMode };

    try {
      const settings = await prisma.siteSettings.upsert({
        where: { id: SITE_SETTINGS_ID },
        create: { id: SITE_SETTINGS_ID, ...data },
        update: data,
        select,
      });

      return ok(normalizeAppearance(settings));
    } catch {
      console.error("PUT /api/admin/settings/appearance failed");

      return oops();
    }
  },
  "settings",
);
