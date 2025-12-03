import { prisma } from "@nextpress/db/src/client";

export type TagDto = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Internal helper to map a taxonomy record to a TagDto.
 */
function mapTaxonomyToTagDto(t: { id: string; name: string; slug: string }): TagDto {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
  };
}

/**
 * Shared small helper to normalize and filter tagIds.
 * This belongs here because it is data-shape oriented and reused by multiple services.
 */
export function normalizeTagIds(tagIds: unknown): string[] {
  if (!Array.isArray(tagIds)) return [];
  return tagIds
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean);
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
export async function findTagByNameInsensitive(name: string): Promise<TagDto | null> {
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

  if (!found || found.type !== "TAG") return null;

  return mapTaxonomyToTagDto(found);
}

/**
 * Create a new tag with the given name and slug.
 * The name and slug should be fully validated and normalized in the service layer.
 */
export async function createTagRecord(name: string, slug: string): Promise<TagDto> {
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
      where: { id },
    });

    if (deleted.type !== "TAG") {
      // Theoretically should not happen if IDs are scoped correctly.
      return null;
    }

    return mapTaxonomyToTagDto(deleted);
  } catch {
    // If the record is not found or delete fails, return null.
    return null;
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
  tagIds: string[]
): Promise<void> {
  await prisma.$transaction([
    prisma.pageOnTaxonomy.deleteMany({ where: { pageId } }),
    ...(tagIds.length
      ? [
        prisma.pageOnTaxonomy.createMany({
          data: tagIds.map((taxonomyId) => ({ pageId, taxonomyId })),
          skipDuplicates: true,
        }),
      ]
      : []),
  ]);
}
