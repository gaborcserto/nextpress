import {
  PublicSearchQuerySchema,
  PublicSearchResultSchema,
} from "@nextpress/shared/api-contracts";

import { bad, ok, oops } from "@/lib/api/http";
import { searchPublishedContent } from "@/lib/public/search.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => params.getAll(key).length !== 1)) {
    return bad("Invalid search parameters");
  }

  const parsed = PublicSearchQuerySchema.strict().safeParse(
    Object.fromEntries(params),
  );
  if (!parsed.success) {
    return bad("Invalid search parameters");
  }

  try {
    const response = ok(
      PublicSearchResultSchema.parse(await searchPublishedContent(parsed.data)),
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return oops();
  }
}
