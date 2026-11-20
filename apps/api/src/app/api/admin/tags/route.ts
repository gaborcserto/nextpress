import { TaxonomyListFiltersSchema } from "@nextpress/shared/api-contracts";

import { ok, bad, internalError } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import { listTaxonomyPage } from "@/lib/repos/tagRepo";
import { listTagsWithUsageService } from "@/lib/services/tag.server";
import { parsePagination } from "@/lib/validation";
import { parseListFilters } from "@/lib/validation/list-query";

export const runtime = "nodejs";

export const GET = withAuth(["ADMIN", "EDITOR", "AUTHOR"], async (req) => {
  const params = new URL(req.url).searchParams;

  try {
    if (params.size > 0) {
      const filters = parseListFilters(params, TaxonomyListFiltersSchema);
      const pagination = parsePagination(params);

      if (!filters || !pagination) {
        return bad("Invalid taxonomy list query");
      }

      return ok(
        await listTaxonomyPage(filters, pagination.page, pagination.limit),
      );
    }

    const items = await listTagsWithUsageService();

    return ok(items);
  } catch (error) {
    return internalError(error);
  }
});
