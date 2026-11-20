import type { Prisma } from "@nextpress/db";

export function publicPublicationWhere(
  now: Date,
): Pick<Prisma.PageWhereInput, "status" | "publishedAt"> {
  return {
    status: "PUBLISHED",
    publishedAt: { not: null, lte: now },
  };
}
