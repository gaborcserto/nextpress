import { PublicNavigationSchema } from "@nextpress/shared/api-contracts";

import { ok, oops } from "@/lib/api/http";
import { getPublicPageNavigation } from "@/lib/public/content.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const response = ok(
      PublicNavigationSchema.parse(await getPublicPageNavigation()),
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return oops();
  }
}
