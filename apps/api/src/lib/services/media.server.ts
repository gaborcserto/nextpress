import "server-only";

import { prisma } from "@nextpress/db/src/client";
import { MediaUploadSchema } from "@nextpress/shared/media";
import {
  pageMediaIds,
  readPageDocument,
} from "@nextpress/shared/page-document";
import { randomUUID } from "node:crypto";
import sharp, { type Metadata } from "sharp";

import {
  contentWriteWhere,
  ContentForbiddenError,
  ContentNotFoundError,
  isEditor,
  type ContentActor,
} from "@/lib/auth/content-access";

import { mediaStorage } from "./media-storage.server";

const metadata = {
  id: true,
  url: true,
  alt: true,
  mime: true,
  width: true,
  height: true,
} as const;
export class MediaValidationError extends Error {}
export class MediaReferencedError extends Error {}

export async function listMedia(actor: ContentActor) {
  contentWriteWhere(actor);

  return prisma.media.findMany({
    where: isEditor(actor) ? {} : { uploadedById: actor.id },
    select: metadata,
    take: 100,
    orderBy: { createdAt: "desc" },
  });
}

export async function uploadMedia(input: unknown, actor: ContentActor) {
  contentWriteWhere(actor);
  const parsed = MediaUploadSchema.parse(input);
  const bytes = Buffer.from(parsed.data, "base64");
  const isPng = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;

  if (
    bytes.length > 2_097_152 ||
    (parsed.mime === "image/png" ? !isPng : !isJpeg)
  )
    throw new MediaValidationError();
  let normalized: Buffer;
  let dimensions: Metadata;

  try {
    const image = sharp(bytes, {
      limitInputPixels: 16_000_000,
      animated: false,
    });
    dimensions = await image.metadata();
    normalized = await image.png().toBuffer();
  } catch {
    throw new MediaValidationError();
  }
  if (normalized.length > 8_388_608 || !dimensions.width || !dimensions.height)
    throw new MediaValidationError();
  const key = `${randomUUID()}.png`;
  await mediaStorage.put(key, normalized);
  try {
    const id = randomUUID();

    return await prisma.media.create({
      data: {
        id,
        key,
        url: `/media/${id}`,
        mime: "image/png",
        alt: parsed.alt,
        width: dimensions.width,
        height: dimensions.height,
        uploadedById: actor.id,
      },
      select: metadata,
    });
  } catch (error) {
    await mediaStorage.remove(key);
    throw error;
  }
}

export async function serveMedia(id: string, actor?: ContentActor) {
  const media = await prisma.media.findUnique({ where: { id } });

  if (!media?.key) throw new ContentNotFoundError();
  const canManage =
    actor &&
    (isEditor(actor) ||
      (actor.role === "AUTHOR" && media.uploadedById === actor.id));

  if (!canManage) {
    const published = await prisma.page.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { not: null, lte: new Date() },
        OR: [
          { coverId: id },
          { pageDocument: { contains: JSON.stringify(id) } },
        ],
      },
      select: { coverId: true, pageDocument: true },
    });
    const referenced = published.some((page) => {
      if (page.coverId === id) return true;
      const document = page.pageDocument
        ? readPageDocument(page.pageDocument)
        : null;

      return (
        document?.supported && pageMediaIds(document.document).includes(id)
      );
    });

    if (!referenced) throw new ContentNotFoundError();
  }
  const bytes = await mediaStorage.read(media.key);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/png",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}

export async function deleteMedia(id: string, actor: ContentActor) {
  contentWriteWhere(actor);
  // Shared with revision writes so reference checks and deletion cannot race.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71520261111::bigint)`;
    const media = await tx.media.findUnique({ where: { id } });

    if (!media) throw new ContentNotFoundError();

    if (!isEditor(actor) && media.uploadedById !== actor.id)
      throw new ContentForbiddenError();
    const references = await tx.page.count({
      where: {
        OR: [
          { coverId: id },
          { pageDocument: { contains: JSON.stringify(id) } },
          { gallery: { some: { mediaId: id } } },
        ],
      },
    });
    const revisions = await tx.pageRevision.count({
      where: { pageDocument: { contains: JSON.stringify(id) } },
    });

    if (references || revisions) throw new MediaReferencedError();
    await tx.media.delete({ where: { id } });
    // Removing metadata first fails closed if file removal requires operator retry.
    if (media.key) await mediaStorage.remove(media.key);
  });
}
