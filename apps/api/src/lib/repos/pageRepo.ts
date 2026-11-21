import { prisma } from "@nextpress/db/src/client";
import {
  ContentLayoutSchema,
  resolvePageType,
} from "@nextpress/shared/content";

import {
  contentReadWhere,
  contentWriteWhere,
  type ContentActor,
} from "@/lib/auth/content-access";
import {
  editorialPublicationState,
  editorialPublicationWhere,
  resolvePublicationDate,
} from "@/lib/publication";
import { ContentVersionConflictError, slugify } from "@/lib/utils";
import { escapeListSearch } from "@/lib/validation/list-query";

import { setTagsForPage } from "./tagRepo";

import type { Prisma } from "@nextpress/db/generated/prisma/client";
import type {
  PageListFiltersSchema,
  PostListFiltersSchema,
} from "@nextpress/shared/api-contracts";
import type { z } from "zod";

import type { PageCreateInput, PageUpdateInput } from "@/lib/validation";

type PageTypeLiteral = "PAGE" | "POST";

/**
 * Retrieve a page (or post) by ID or slug.
 * Defaults to PAGE unless a type is explicitly provided.
 */
export async function getPageById(
  idOrSlug?: string | null,
  opts?: { type?: PageTypeLiteral; actor?: ContentActor | null },
) {
  const ref = (idOrSlug ?? "").trim();

  if (!ref) {
    return null;
  }

  // When type is not provided, default to PAGE
  const typeFilter = opts?.type ?? "PAGE";

  // 1) Try by ID
  const byId = await prisma.page.findUnique({
    where: { ...contentReadWhere(opts?.actor), id: ref, type: typeFilter },
    include: {
      cover: { select: { id: true, url: true, alt: true } },
      listingTaxonomy: { select: { id: true, name: true, slug: true } },
    },
  });

  if (byId && byId.type === typeFilter) {
    return byId;
  }

  // 2) Fallback: try by slug
  const bySlug = await prisma.page.findUnique({
    where: {
      ...contentReadWhere(opts?.actor),
      slug: slugify(ref),
      type: typeFilter,
    },
    include: {
      cover: { select: { id: true, url: true, alt: true } },
      listingTaxonomy: { select: { id: true, name: true, slug: true } },
    },
  });

  if (bySlug && bySlug.type === typeFilter) {
    return bySlug;
  }

  return null;
}

export type ContentListFilters = z.infer<typeof PageListFiltersSchema> &
  z.infer<typeof PostListFiltersSchema>;

export async function listPages(
  skip: number,
  take: number,
  opts?: {
    type?: PageTypeLiteral;
    actor?: ContentActor | null;
    filters?: ContentListFilters;
  },
) {
  const {
    q,
    sort = "updatedAt",
    direction = "desc",
    status,
    pageType,
    tag,
    category,
  } = opts?.filters ?? {};
  const now = new Date();
  const access = contentReadWhere(opts?.actor, now);
  const conditions: Prisma.PageWhereInput[] = [];

  if (q) {
    const contains = {
      contains: escapeListSearch(q),
      mode: "insensitive",
    } as const;
    conditions.push({ OR: [{ title: contains }, { slug: contains }] });
  }

  if (status) {
    conditions.push(editorialPublicationWhere(status, now));
  }

  if (pageType) {
    const layouts = ContentLayoutSchema.options.filter(
      (layout) => resolvePageType(layout) === pageType,
    );
    conditions.push({ layout: { in: layouts } });
  }

  if (tag) {
    conditions.push({
      taxonomies: { some: { taxonomy: { type: "TAG", slug: tag } } },
    });
  }

  if (category) {
    conditions.push({
      taxonomies: { some: { taxonomy: { type: "CATEGORY", slug: category } } },
    });
  }

  const where: Prisma.PageWhereInput = {
    type: opts?.type ?? "PAGE",
    ...access,
    ...(conditions.length && { AND: conditions }),
  };
  const order: Prisma.PageOrderByWithRelationInput =
    sort === "publishedAt"
      ? { publishedAt: { sort: direction, nulls: "last" } }
      : { [sort]: direction };

  const [items, total] = await prisma.$transaction(
    async (tx) => {
      const items = await tx.page.findMany({
        where,
        orderBy: [order, { id: "asc" }],
        skip,
        take,
        select: {
          id: true,
          type: true,
          layout: true,
          status: true,
          publishedAt: true,
          slug: true,
          title: true,
          excerpt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const total = await tx.page.count({ where });

      return [items, total] as const;
    },
    { isolationLevel: "RepeatableRead" },
  );

  return {
    items: items.map((item) => ({
      ...item,
      publicationState: editorialPublicationState(
        item.status,
        item.publishedAt,
        now,
      ),
    })),
    total,
  };
}

/**
 * Ensure that a given slug is globally unique.
 * This validation applies to both pages and posts.
 */
export async function ensureUniqueSlug(
  opts: { slug: string; excludeId?: string },
  db: Prisma.TransactionClient = prisma,
) {
  const clean = slugify(opts.slug);

  const exists = await db.page.findFirst({
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
  input: PageCreateInput & { authorId?: string | null },
  db: Prisma.TransactionClient = prisma,
) {
  const cleanSlug = slugify(input.slug);
  await ensureUniqueSlug({ slug: cleanSlug }, db);

  return db.page.create({
    data: {
      type: input.type,
      status: input.status,
      slug: cleanSlug,
      title: input.title,
      excerpt: input.excerpt ?? null,
      content: input.content ?? "",
      layout: input.layout,
      ...(input.listingTaxonomyId !== undefined
        ? { listingTaxonomyId: input.listingTaxonomyId }
        : {}),
      inHeaderMenu: input.inHeaderMenu,
      inFooterMenu: input.inFooterMenu,
      publishedAt: resolvePublicationDate(null, input),
      authorId: input.authorId ?? null,
    },
  });
}

/**
 * Update PAGE (or POST) record.
 * If slug is provided, normalize and check for uniqueness.
 */
export async function updatePage(
  id: string,
  data: PageUpdateInput,
  type: PageTypeLiteral,
  actor: ContentActor,
  db: Prisma.TransactionClient = prisma,
) {
  const { expectedVersion, ...next } = data;

  if (typeof data.slug === "string") {
    next.slug = slugify(data.slug);
    await ensureUniqueSlug({ slug: next.slug, excludeId: id }, db);
  }

  const current = await db.page.findUniqueOrThrow({
    where: { id, type, ...contentWriteWhere(actor) },
    select: { status: true, publishedAt: true },
  });

  const publishedAt = resolvePublicationDate(current, next);

  return db.page.update({
    where: {
      id,
      type,
      ...contentWriteWhere(actor),
      workingVersion: expectedVersion,
    },
    data: { ...next, publishedAt, workingVersion: { increment: 1 } },
  });
}

/**
 * Permanently delete a PAGE or POST record.
 * Cascade rules are handled by Prisma relations.
 */
export async function deletePage(
  id: string,
  type: PageTypeLiteral,
  actor: ContentActor,
) {
  await prisma.page.delete({
    where: { id, type, ...contentWriteWhere(actor) },
  });
}

/** Persist the content aggregate and TAG links in one transaction. */
export async function createPageWithTags(
  input: PageCreateInput & { authorId: string },
  tagIds: string[],
) {
  return prisma.$transaction(async (tx) => {
    const page = await createPage(input, tx);
    await setTagsForPage(page.id, tagIds, tx);

    return page;
  });
}

export async function updatePageWithTags(
  id: string,
  input: PageUpdateInput,
  type: PageTypeLiteral,
  actor: ContentActor,
  tagIds?: string[],
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const page = await updatePage(id, input, type, actor, tx);

      if (tagIds !== undefined) {
        await setTagsForPage(page.id, tagIds, tx);
      }

      return page;
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      throw new ContentVersionConflictError();
    }

    throw error;
  }
}
