import { prisma } from "@nextpress/db/src/client";

import { slugify } from "@/lib/utils";
import type { PageCreateInput, PageUpdateInput } from "@/lib/validation";

type PageTypeLiteral = "PAGE" | "POST";

/**
 * Retrieve a page (or post) by ID or slug.
 * Defaults to PAGE unless a type is explicitly provided.
 */
export async function getPageById(
  idOrSlug?: string | null,
  opts?: { type?: PageTypeLiteral }
) {
  const ref = (idOrSlug ?? "").trim();
  if (!ref) return null;

  // When type is not provided, default to PAGE
  const typeFilter = opts?.type ?? "PAGE";

  // 1) Try by ID
  const byId = await prisma.page.findUnique({
    where: { id: ref },
  });

  if (byId && byId.type === typeFilter) return byId;

  // 2) Fallback: try by slug
  const bySlug = await prisma.page.findUnique({
    where: { slug: slugify(ref) },
  });

  if (bySlug && bySlug.type === typeFilter) return bySlug;

  return null;
}

/**
 * Fetch paginated list of pages (or posts).
 * Defaults to PAGE if no type is provided.
 */
export async function listPages(
  skip: number,
  take: number,
  opts?: { type?: PageTypeLiteral }
) {
  const typeFilter = opts?.type ?? "PAGE";

  const where = { type: typeFilter };

  const [items, total] = await Promise.all([
    prisma.page.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        type: true,
        status: true,
        slug: true,
        title: true,
        excerpt: true,
        updatedAt: true,
      },
    }),
    prisma.page.count({ where }),
  ]);

  return { items, total };
}

/**
 * Ensure that a given slug is globally unique.
 * This validation applies to both pages and posts.
 */
export async function ensureUniqueSlug(opts: { slug: string; excludeId?: string }) {
  const clean = slugify(opts.slug);

  const exists = await prisma.page.findFirst({
    where: opts.excludeId
      ? { slug: clean, NOT: { id: opts.excludeId } }
      : { slug: clean },
    select: { id: true },
  });

  if (exists) {
    throw Object.assign(new Error("Slug already exists"), {
      code: "SLUG_CONFLICT" as const,
    });
  }
}

/**
 * Create a new PAGE (default).
 * POST creation can easily extend this with { type: 'POST' }.
 */
export async function createPage(
  input: PageCreateInput & { authorId?: string | null }
) {
  const cleanSlug = slugify(input.slug);
  await ensureUniqueSlug({ slug: cleanSlug });

  return prisma.page.create({
    data: {
      type: input.type,
      status: input.status,
      slug: cleanSlug,
      title: input.title,
      excerpt: input.excerpt ?? null,
      content: input.content ?? "",
      authorId: input.authorId ?? null,
    },
  });
}

/**
 * Update PAGE (or POST) record.
 * If slug is provided, normalize and check for uniqueness.
 */
export async function updatePage(id: string, data: PageUpdateInput) {
  const next: PageUpdateInput = { ...data };

  if (typeof data.slug === "string") {
    next.slug = slugify(data.slug);
    await ensureUniqueSlug({ slug: next.slug, excludeId: id });
  }

  return prisma.page.update({
    where: { id },
    data: next,
  });
}

/**
 * Permanently delete a PAGE or POST record.
 * Cascade rules are handled by Prisma relations.
 */
export async function deletePage(id: string) {
  await prisma.page.delete({ where: { id } });
}
