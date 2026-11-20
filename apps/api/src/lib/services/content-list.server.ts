import { listPages } from "@/lib/repos";

import type { ContentActor, ContentType } from "@/lib/auth/content-access";
import type { ContentListFilters } from "@/lib/repos/pageRepo";

export async function listAdministrativeContent(
  type: ContentType,
  page: number,
  limit: number,
  actor?: ContentActor | null,
  filters?: ContentListFilters,
) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const { items, total } = await listPages(skip, safeLimit, {
    type,
    actor,
    ...(filters && { filters }),
  });

  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    pages: Math.ceil(total / safeLimit),
  };
}
