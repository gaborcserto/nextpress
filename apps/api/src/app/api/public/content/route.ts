import { prisma } from "@nextpress/db/src/client";
import { PublicContentIndexQuerySchema } from "@nextpress/shared/api-contracts";

import { bad, ok, internalError } from "@/lib/api";
import { withRequestLogging } from "@/lib/api/request-logging.server";

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
    const rows = await prisma.page.findMany({
      where: {
        type: kind,
        status: "PUBLISHED",
        publishedAt: { not: null, lte: new Date() },
        ...(taxonomyId ? { taxonomies: { some: { taxonomyId } } } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { slug: "asc" }],
      take: limit + 1,
      skip: offset,
      select: { type: true, slug: true, title: true, updatedAt: true },
    });

    return ok({ items: rows.slice(0, limit), hasMore: rows.length > limit });
  } catch (error) {
    return internalError(error);
  }
}

export const GET = withRequestLogging("public.content", get);
