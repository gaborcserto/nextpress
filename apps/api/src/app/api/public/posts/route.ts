import {
  PublicPaginationSchema,
  PublicPostBatchSchema,
} from "@nextpress/shared/api-contracts";

import { ok, bad, oops } from "@/lib/api/http";
import { getPublishedPosts } from "@/lib/public/content.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (
    ["limit", "offset"].some(
      (key) =>
        params.getAll(key).length > 1 ||
        (params.has(key) && !/^\d+$/.test(params.get(key) ?? "")),
    )
  )
    return bad("Invalid pagination");
  const parsed = PublicPaginationSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) return bad("Invalid pagination");
  try {
    const response = ok(
      PublicPostBatchSchema.parse(await getPublishedPosts(parsed.data)),
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return oops();
  }
}
