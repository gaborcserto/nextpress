import {
  isPagePath,
  maxPageDepth,
  pageLayouts,
} from "@nextpress/shared/content";

import { publicPublicationWhere } from "@/lib/public/eligibility";

import type { Prisma } from "@nextpress/db";

const pathSelect = {
  id: true,
  parentId: true,
  slug: true,
  layout: true,
} as const;
type PathRow = Prisma.PageGetPayload<{ select: typeof pathSelect }>;

export async function publishedPagePaths(
  db: Prisma.TransactionClient,
  ids: string[],
  now: Date,
) {
  const rows = new Map<string, PathRow>();
  let pending = [...new Set(ids)];

  for (let depth = 0; pending.length && depth < maxPageDepth; depth++) {
    const batch = await db.page.findMany({
      where: {
        id: { in: pending },
        type: "PAGE",
        ...publicPublicationWhere(now),
      },
      select: pathSelect,
    });
    const parents = new Set<string>();

    for (const row of batch) {
      rows.set(row.id, row);

      if (row.parentId && !rows.has(row.parentId)) {
        parents.add(row.parentId);
      }
    }

    pending = [...parents].filter((id) => !rows.has(id));
  }

  const paths = new Map<string, string>();

  for (const id of ids) {
    const segments: string[] = [];
    let row = rows.get(id);

    while (row && segments.length < maxPageDepth) {
      segments.unshift(row.slug);

      if (!row.parentId) {
        const path = isPagePath(segments) ? `/${segments.join("/")}` : null;

        if (segments.length === 1 && row.layout === pageLayouts.home) {
          paths.set(id, "/");
        } else if (path) {
          paths.set(id, path);
        } else {
          paths.set(id, `/pages/${segments.at(-1)}`);
        }

        break;
      }

      row = rows.get(row.parentId);
    }
  }

  return paths;
}
