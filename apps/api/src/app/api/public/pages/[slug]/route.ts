import { PublicContentSchema } from "@nextpress/shared/api-contracts";

import { ok, notfound, internalError } from "@/lib/api/http";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { getPublishedPage } from "@/lib/public/content.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function get(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const item = await getPublishedPage(
      (await params).slug,
      new URL(req.url).searchParams.get("path") ?? undefined,
    );

    const response = item ? ok(PublicContentSchema.parse(item)) : notfound();
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    return internalError(error);
  }
}

export const GET = withRequestLogging("public.content", get);
