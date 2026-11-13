import "server-only";

import { prisma, type Prisma } from "@nextpress/db";
import { PublicSearchQuerySchema } from "@nextpress/shared/api-contracts";
import { richContentText } from "@nextpress/shared/content";

import { parsePublicRichContent } from "./rich-content";

import type { z } from "zod";

export async function searchPublishedContent(
  input: z.input<typeof PublicSearchQuerySchema>,
) {
  const query = PublicSearchQuerySchema.parse(input);
  const published = {
    status: "PUBLISHED",
    publishedAt: { not: null, lte: new Date() },
  } satisfies Prisma.PageWhereInput;
  const taxonomies = await prisma.taxonomy.findMany({
    where: { pages: { some: { page: { ...published, type: "POST" } } } },
    select: { type: true, slug: true, name: true },
    orderBy: { slug: "asc" },
  });

  if (!query.q) {
    return { results: [], total: 0, taxonomies };
  }

  const term = query.q.replace(/[\\%_]/g, "\\$&");
  const title = {
    title: { contains: term, mode: "insensitive" },
  } satisfies Prisma.PageWhereInput;
  const assignments =
    query.type === "pages"
      ? []
      : [
          ...(query.category
            ? [{ type: "CATEGORY" as const, slug: query.category }]
            : []),
          ...(query.tag ? [{ type: "TAG" as const, slug: query.tag }] : []),
        ];
  const where: Prisma.PageWhereInput = {
    ...published,
    ...(query.type !== "all"
      ? { type: query.type === "posts" ? "POST" : "PAGE" }
      : {}),
    AND: assignments.map((taxonomy) => ({
      type: "POST",
      taxonomies: { some: { taxonomy } },
    })),
    OR: [
      title,
      ...(["excerpt", "content", "pageDocument"] as const).map((field) => ({
        [field]: { contains: term, mode: "insensitive" },
      })),
    ],
  };
  const select = {
    type: true,
    slug: true,
    title: true,
    excerpt: true,
    publishedAt: true,
    taxonomies: {
      select: { taxonomy: { select: { type: true, slug: true, name: true } } },
    },
  } satisfies Prisma.PageSelect;
  const orderBy: Prisma.PageOrderByWithRelationInput[] = [
    { publishedAt: "desc" },
    { slug: "asc" },
  ];
  const skip = (query.page - 1) * 10;
  const total = await prisma.page.count({ where });
  let rows;

  if (query.sort === "newest") {
    rows = await prisma.page.findMany({
      where,
      select,
      orderBy,
      skip,
      take: 10,
    });
  } else {
    // Two disjoint tiers keep ranking and pagination in PostgreSQL, without loading the corpus.
    const titleWhere = { AND: [where, title] };
    const titleCount = await prisma.page.count({ where: titleWhere });
    const titleRows =
      skip < titleCount
        ? await prisma.page.findMany({
            where: titleWhere,
            select,
            orderBy,
            skip,
            take: 10,
          })
        : [];
    const bodyRows =
      titleRows.length < 10
        ? await prisma.page.findMany({
            where: { AND: [where, { NOT: title }] },
            select,
            orderBy,
            skip: Math.max(0, skip - titleCount),
            take: 10 - titleRows.length,
          })
        : [];
    rows = [...titleRows, ...bodyRows];
  }

  return {
    total,
    taxonomies,
    results: rows.map((row) => {
      if (!row.publishedAt) {
        throw new Error("Missing publication time");
      }

      return {
        type: row.type,
        slug: row.slug,
        title: row.title,
        summary: richContentText(parsePublicRichContent(row.excerpt)).slice(
          0,
          300,
        ),
        publishedAt: row.publishedAt.toISOString(),
        author: null,
        cover: null,
        taxonomies:
          row.type === "POST"
            ? row.taxonomies.map(({ taxonomy }) => taxonomy)
            : [],
      };
    }),
  };
}
