import { PublicContentSchema } from "@nextpress/shared/api-contracts";

import { ok, notfound, oops } from "@/lib/api/http";
import { getPublishedPost } from "@/lib/public/content.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const item = await getPublishedPost((await params).slug);
    const response = item ? ok(PublicContentSchema.parse(item)) : notfound();
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return oops();
  }
}
