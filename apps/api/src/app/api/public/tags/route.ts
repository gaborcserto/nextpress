import {
  PublicPaginationSchema,
  PublicTagBatchSchema,
} from "@nextpress/shared/api-contracts";

import { bad, ok, oops } from "@/lib/api/http";
import { getPublishedTags } from "@/lib/public/content.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
  } catch {
    return oops();
  }
}
