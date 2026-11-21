import { prisma } from "@nextpress/db/src/client";
import { PublicContentIndexQuerySchema } from "@nextpress/shared/api-contracts";

import { bad, ok, internalError } from "@/lib/api";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { publicPublicationWhere } from "@/lib/public/eligibility";
import { publishedPagePaths } from "@/lib/repos/page-hierarchy";

async function get(req: Request) {
  const params = new URL(req.url).searchParams;

  if ([...params.keys()].some((key) => params.getAll(key).length > 1)) {
    return bad("Duplicate query parameters");
  }

  const parsed = PublicContentIndexQuerySchema.safeParse(
    Object.fromEntries(params),
  );

  if (!parsed.success) {
    return bad("Invalid content query");
  }

  const { kind, taxonomyId, limit, offset } = parsed.data;

  try {
    const now = new Date();
    const rows = await prisma.page.findMany({
      where: {
        type: kind,
        ...publicPublicationWhere(now),
        ...(taxonomyId ? { taxonomies: { some: { taxonomyId } } } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { slug: "asc" }],
      take: limit + 1,
      skip: offset,
      select: {
        id: true,
        type: true,
        slug: true,
        title: true,
        updatedAt: true,
      },
    });

    const batch = rows.slice(0, limit);

    const paths = await publishedPagePaths(
      prisma,
      batch.filter(({ type }) => type === "PAGE").map(({ id }) => id),
      now,
    );

    const items = batch.flatMap(({ id, ...item }) => {
      if (item.type === "POST") {
        return [item];
      }

      const canonicalPath = paths.get(id);

      return canonicalPath ? [{ ...item, canonicalPath }] : [];
    });

    return ok({ items, hasMore: rows.length > limit });
  } catch (error) {
    return internalError(error);
  }
}

export const GET = withRequestLogging("public.content", get);
