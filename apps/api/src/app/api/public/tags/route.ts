import {
  PublicPaginationSchema,
  PublicTagBatchSchema,
} from "@nextpress/shared/api-contracts";

import { bad, ok, internalError } from "@/lib/api/http";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { getPublishedTags } from "@/lib/public/content.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function get(req: Request) {
  const query = new URL(req.url).searchParams;

  if (
    [...query.keys()].some(
      (key) =>
        !["limit", "offset"].includes(key) ||
        query.getAll(key).length > 1 ||
        !/^\d+$/.test(query.get(key) ?? ""),
    )
  ) {
    return bad("Invalid pagination");
  }

  const parsed = PublicPaginationSchema.safeParse(Object.fromEntries(query));

  if (!parsed.success) {
    return bad("Invalid pagination");
  }

  try {
    const response = ok(
      PublicTagBatchSchema.parse(await getPublishedTags(parsed.data)),
    );
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    return internalError(error);
  }
}

export const GET = withRequestLogging("public.content", get);
