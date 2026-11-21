import "server-only";

import { prisma } from "@nextpress/db/src/client";

import {
  contentWriteWhere,
  ContentNotFoundError,
  isEditor,
  type ContentActor,
} from "@/lib/auth/content-access";
import { escapeListSearch } from "@/lib/validation/list-query";

import type { Prisma } from "@nextpress/db/generated/prisma/client";
import type { MediaBrowse, MediaEdit } from "@nextpress/shared/media";

export const libraryMetadata = {
  id: true,
  url: true,
  alt: true,
  mime: true,
  width: true,
  height: true,
  filename: true,
  originalMime: true,
  size: true,
  caption: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function mediaWriteWhere(actor: ContentActor) {
  contentWriteWhere(actor);

  return isEditor(actor) ? {} : { uploadedById: actor.id };
}

export async function browseMedia(query: MediaBrowse, actor: ContentActor) {
  const { page, q, sort, direction, mime } = query;
  const pageSize = 24;
  const where: Prisma.MediaWhereInput = mediaWriteWhere(actor);

  if (mime) {
    where.AND = [
      { OR: [{ originalMime: mime }, { originalMime: null, mime }] },
    ];
  }

  if (q) {
    const search = {
      contains: escapeListSearch(q),
      mode: "insensitive",
    } as const;
    where.OR = [
      { filename: search },
      { alt: search },
      { caption: search },
      { description: search },
    ];
  }

  const order: Prisma.MediaOrderByWithRelationInput =
    sort === "createdAt"
      ? { createdAt: direction }
      : { [sort]: { sort: direction, nulls: "last" } };

  const items = await prisma.media.findMany({
    where,
    orderBy: [order, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: libraryMetadata,
  });

  return { items: items.slice(0, pageSize), hasMore: items.length > pageSize };
}

export async function isMediaReferenced(
  id: string,
  db: Prisma.TransactionClient,
) {
  const reference = JSON.stringify(id);

  const [pages, revisions, retainedMedia] = await Promise.all([
    db.page.count({
      where: {
        OR: [
          { coverId: id },
          { gallery: { some: { mediaId: id } } },
          { pageDocument: { contains: reference } },
        ],
      },
    }),
    db.pageRevision.count({ where: { pageDocument: { contains: reference } } }),
    db.media.count({
      where: {
        id,
        OR: [
          { back_ContentRevisionMedia_target: { some: {} } },
          { privateWorkingReferences: { some: {} } },
        ],
      },
    }),
  ]);

  return Boolean(pages || revisions || retainedMedia);
}

export async function mediaDetails(id: string, actor: ContentActor) {
  const item = await prisma.media.findUnique({
    where: { id, ...mediaWriteWhere(actor) },
    select: libraryMetadata,
  });

  if (!item) {
    throw new ContentNotFoundError();
  }

  return {
    ...item,
    inUse: isEditor(actor) ? await isMediaReferenced(id, prisma) : null,
  };
}

export async function editMedia(
  id: string,
  changes: MediaEdit,
  actor: ContentActor,
) {
  try {
    return await prisma.media.update({
      where: { id, ...mediaWriteWhere(actor) },
      data: {
        alt: changes.alt,
        caption: changes.caption || null,
        description: changes.description || null,
      },
      select: libraryMetadata,
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      throw new ContentNotFoundError();
    }

    throw error;
  }
}
