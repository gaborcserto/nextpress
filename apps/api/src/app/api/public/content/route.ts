import { prisma } from "@nextpress/db/src/client";
import { PublicContentIndexQuerySchema } from "@nextpress/shared/api-contracts";

import { bad, ok, oops } from "@/lib/api";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if ([...params.keys()].some((key) => params.getAll(key).length > 1))
    return bad("Duplicate query parameters");
  const parsed = PublicContentIndexQuerySchema.safeParse(
    Object.fromEntries(params),
  );
  if (!parsed.success) return bad("Invalid content query");
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
  } catch {
    return oops();
  }
}
