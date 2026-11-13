import {
  PublicPaginationSchema,
  PublicTaxonomyParamsSchema,
  PublicTaxonomyBatchSchema,
} from "@nextpress/shared/api-contracts";

import { bad, notfound, ok, oops } from "@/lib/api/http";
import { getPublishedTaxonomyPosts } from "@/lib/public/content.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string; slug: string }> },
) {
  const taxonomy = PublicTaxonomyParamsSchema.safeParse(await params);

  if (!taxonomy.success) {
    return notfound();
  }

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

  const pagination = PublicPaginationSchema.safeParse(
    Object.fromEntries(query),
  );

  if (!pagination.success) {
    return bad("Invalid pagination");
  }

  try {
    const batch = await getPublishedTaxonomyPosts(
      taxonomy.data,
      pagination.data,
    );
    const response = batch
      ? ok(PublicTaxonomyBatchSchema.parse(batch))
      : notfound();
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch {
    return oops();
  }
}
