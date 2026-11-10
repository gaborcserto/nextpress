import { PublicSiteSettingsSchema } from "@nextpress/shared/api-contracts";

import { ok, oops } from "@/lib/api/http";
import { getPublicSiteSettings } from "@/lib/public/settings.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const response = ok(
      PublicSiteSettingsSchema.parse(await getPublicSiteSettings()),
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return oops();
  }
}
