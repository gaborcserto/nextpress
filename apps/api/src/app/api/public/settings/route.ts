import { PublicSiteSettingsSchema } from "@nextpress/shared/api-contracts";

import { ok, internalError } from "@/lib/api/http";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { getPublicSiteSettings } from "@/lib/public/settings.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function get() {
  try {
    const response = ok(
      PublicSiteSettingsSchema.parse(await getPublicSiteSettings()),
    );
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    return internalError(error);
  }
}

export const GET = withRequestLogging("public.settings", get);
