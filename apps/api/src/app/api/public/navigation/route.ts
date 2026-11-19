import { PublicNavigationSchema } from "@nextpress/shared/api-contracts";

import { ok, internalError } from "@/lib/api/http";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { getPublicPageNavigation } from "@/lib/public/content.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function get() {
  try {
    const response = ok(
      PublicNavigationSchema.parse(await getPublicPageNavigation()),
    );
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    return internalError(error);
  }
}

export const GET = withRequestLogging("public.content", get);
