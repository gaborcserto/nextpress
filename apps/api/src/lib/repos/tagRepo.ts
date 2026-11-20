import { Prisma } from "@nextpress/db/generated/prisma/client";
import { prisma } from "@nextpress/db/src/client";

import {
  contentWriteWhere,
  type ContentActor,
} from "@/lib/auth/content-access";
import { escapeListSearch } from "@/lib/validation/list-query";

import type { TaxonomyListFiltersSchema } from "@nextpress/shared/api-contracts";
import type { z } from "zod";

export type TaxonomyListFilters = z.infer<typeof TaxonomyListFiltersSchema>;

export class TaxonomyScopeError extends Error {
  constructor() {
    super("Invalid tag IDs");
  }
}

export async function validateTagIds(
  tagIds: string[],
  db: Pick<Prisma.TransactionClient, "taxonomy"> = prisma,
) {
  const ids = [...new Set(tagIds)];

  if (!ids.length) {
    return;
  }

  const tags = await db.taxonomy.findMany({
    where: { id: { in: ids }, type: "TAG" },
    select: { id: true },
  });

  if (tags.length !== ids.length) {
    throw new TaxonomyScopeError();
  }
}

export type TagDto = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Internal helper to map a taxonomy record to a TagDto.
 */
function mapTaxonomyToTagDto(t: {
  id: string;
  name: string;
  slug: string;
}): TagDto {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
  };
}

/**
 * Find tags by a pre-normalized search query (name or slug).
 * The query should already be trimmed and non-empty in the service layer.
 */
export async function searchTagsRaw(query: string): Promise<TagDto[]> {
  const items = await prisma.taxonomy.findMany({
    where: {
      type: "TAG",
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query } }, // service may pass slugified query here
      ],
    },
    orderBy: { name: "asc" },
    take: 20,
  });

  return items.map(mapTaxonomyToTagDto);
}

/**
 * Find a tag by name using a case-insensitive comparison.
 * The name should already be trimmed in the service layer.
 */
export async function findTagByNameInsensitive(
  name: string,
): Promise<TagDto | null> {
  const existing = await prisma.taxonomy.findFirst({
    where: {
      type: "TAG",
      name: { equals: name, mode: "insensitive" },
    },
  });

  return existing ? mapTaxonomyToTagDto(existing) : null;
}

/**
 * Find a tag by slug.
 */
export async function findTagBySlug(slug: string): Promise<TagDto | null> {
  const found = await prisma.taxonomy.findUnique({
    where: { slug },
  });

  if (!found || found.type !== "TAG") {
    return null;
  }

  return mapTaxonomyToTagDto(found);
}

/**
 * Create a new tag with the given name and slug.
 * The name and slug should be fully validated and normalized in the service layer.
 */
export async function createTagRecord(
  name: string,
  slug: string,
): Promise<TagDto> {
  const created = await prisma.taxonomy.create({
    data: {
      type: "TAG",
      name,
      slug,
    },
  });

  return mapTaxonomyToTagDto(created);
}

/**
 * Delete a tag by ID.
 * Returns the deleted TagDto or null if the tag did not exist.
 */
export async function deleteTagRecord(id: string): Promise<TagDto | null> {
  try {
    const deleted = await prisma.taxonomy.delete({
      where: { id, type: "TAG" },
    });

    return mapTaxonomyToTagDto(deleted);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return null;
    }

    throw error;
  }
}

/**
 * Fetch tags already linked to a Page (via PageOnTaxonomy).
 */
export async function getTagsForPage(pageId: string): Promise<TagDto[]> {
  const links = await prisma.pageOnTaxonomy.findMany({
    where: { pageId },
    include: { taxonomy: true },
  });

  return links
    .filter((l) => l.taxonomy.type === "TAG")
    .map((l) => mapTaxonomyToTagDto(l.taxonomy));
}

/**
 * Replace all tags for a Page.
 */
export async function setTagsForPage(
  pageId: string,
  tagIds: string[],
  transaction?: Prisma.TransactionClient,
  actor?: ContentActor,
): Promise<void> {
  const replace = async (tx: Prisma.TransactionClient) => {
    // Keep classification stable through assignment as well as checking existence.
    // NOWAIT is compatible with legacy deletes holding a target before a Page lock.
    for (const id of [...new Set(tagIds)].sort()) {
      await tx.$queryRaw`SELECT id FROM "Taxonomy" WHERE id = ${id} FOR SHARE NOWAIT`;
    }

    await validateTagIds(tagIds, tx);

    if (!transaction) {
      // Recheck ownership atomically and advance the token for standalone writers.
      // The database trigger acquires the same fence as scalar and private saves.
      await tx.page.update({
        where: { id: pageId, ...(actor ? contentWriteWhere(actor) : {}) },
        data: { workingVersion: { increment: 1 } },
      });
    }

    await tx.page.findUniqueOrThrow({
      where: { id: pageId },
      select: { id: true },
    });
    await tx.pageOnTaxonomy.deleteMany({
      where: { pageId, taxonomy: { type: "TAG" } },
    });

    if (tagIds.length) {
      await tx.pageOnTaxonomy.createMany({
        data: tagIds.map((taxonomyId) => ({ pageId, taxonomyId })),
        skipDuplicates: true,
      });
    }
  };

  if (transaction) {
    await replace(transaction);
  } else {
    await prisma.$transaction(replace);
  }
}

/**
 * Tag DTO extended with usage count.
 * `usedCount` represents how many posts reference this tag.
 */
export type TagWithUsageDto = TagDto & { usedCount: number };

/**
 * List all tags together with their usage count.
 * Usage is calculated based on PageOnTaxonomy relations.
 */
export async function listTagsWithUsage(): Promise<TagWithUsageDto[]> {
  const items = await prisma.taxonomy.findMany({
    where: { type: "TAG" },
    orderBy: { name: "asc" },
    take: 500,
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { pages: { where: { page: { type: "POST" } } } } },
    },
  });

  return items.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    usedCount: t._count.pages,
  }));
}

export async function listTaxonomyPage(
  { type, q, sort = "name", direction = "asc" }: TaxonomyListFilters,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const pattern = q ? "%" + escapeListSearch(q) + "%" : undefined;
  const where = Prisma.sql`t.type = ${type}::"TaxonomyType"
    ${pattern ? Prisma.sql`AND (t.name ILIKE ${pattern} OR t.slug ILIKE ${pattern})` : Prisma.empty}`;
  const columns = {
    name: Prisma.sql`t.name`,
    slug: Prisma.sql`t.slug`,
    usedCount: Prisma.sql`"usedCount"`,
  };
  const order = direction === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  return prisma.$transaction(
    async (tx) => {
      // The count used for ordering must match the displayed post-only count.
      const items = await tx.$queryRaw<TagWithUsageDto[]>`
      SELECT t.id, t.name, t.slug, count(post.id)::integer AS "usedCount"
      FROM "Taxonomy" AS t
      LEFT JOIN "PageOnTaxonomy" AS link ON link."taxonomyId" = t.id
      LEFT JOIN "Page" AS post ON post.id = link."pageId" AND post.type = 'POST'
      WHERE ${where}
      GROUP BY t.id
      ORDER BY ${columns[sort]} ${order}, t.id ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

      const [{ total } = { total: 0 }] = await tx.$queryRaw<
        { total: number }[]
      >`
      SELECT count(*)::integer AS total FROM "Taxonomy" AS t WHERE ${where}
    `;

      return { items, total, page, limit, pages: Math.ceil(total / limit) };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
