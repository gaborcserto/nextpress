import { PublicMenusSchema } from "@nextpress/shared/api-contracts";

import { internalError, ok } from "@/lib/api/http";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { getPublicMenus } from "@/lib/public/menus.server";

export const dynamic = "force-dynamic";

async function get() {
  try {
    const response = ok(PublicMenusSchema.parse(await getPublicMenus()));
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    return internalError(error);
  }
}

export const GET = withRequestLogging("public.content", get);
