import "server-only";

import { prisma } from "@nextpress/db/src/client";
import {
  maxMediaUploadBytes,
  maxStoredMediaBytes,
  MediaInputMimeSchema,
  MediaUploadSchema,
} from "@nextpress/shared/media";
import {
  pageMediaIds,
  readPageDocument,
} from "@nextpress/shared/page-document";
import { writeServerLog } from "@nextpress/shared/server-logging";
import { randomUUID } from "node:crypto";

import { apiLogContext } from "@/lib/api/request-log-context.server";
import {
  contentWriteWhere,
  ContentForbiddenError,
  ContentNotFoundError,
  isEditor,
  type ContentActor,
} from "@/lib/auth/content-access";
import { publicPublicationWhere } from "@/lib/public/eligibility";

import {
  normalizeMediaImage,
  UnsupportedMediaAnimationError,
} from "./media-image.server";
import {
  mediaWriteWhere,
  libraryMetadata,
  isMediaReferenced,
} from "./media-library.server";
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
export class MediaBusyError extends Error {}

let activeDecodes = 0;
const maxActiveDecodes = 2;

function missingFile(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function cleanup(key: string) {
  try {
    await mediaStorage.remove(key);
  } catch (error) {
    if (!missingFile(error)) {
      logCleanupFailure();
    }
  }
}

function logCleanupFailure() {
  writeServerLog("api", "media.cleanup_failed", {
    ...apiLogContext(),
    operation: "media",
  });
}

export async function listMedia(actor: ContentActor) {
  contentWriteWhere(actor);

  return prisma.media.findMany({
    where: isEditor(actor) ? {} : { uploadedById: actor.id },
    select: metadata,
    take: 100,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
}

export async function uploadMedia(input: unknown, actor: ContentActor) {
  contentWriteWhere(actor);
  const parsed = MediaUploadSchema.parse(input);
  const bytes = Buffer.from(parsed.data, "base64");

  if (
    bytes.length > maxMediaUploadBytes ||
    (parsed.filename && /[\\/\p{Cc}\p{Cf}]/u.test(parsed.filename)) ||
    parsed.filename === "." ||
    parsed.filename === ".."
  ) {
    throw new MediaValidationError();
  }

  let normalized: Awaited<ReturnType<typeof normalizeMediaImage>>;

  if (activeDecodes >= maxActiveDecodes) {
    throw new MediaBusyError();
  }

  activeDecodes++;

  try {
    normalized = await normalizeMediaImage(bytes, parsed.mime);
  } catch (error) {
    if (error instanceof UnsupportedMediaAnimationError) {
      throw error;
    }

    throw new MediaValidationError();
  } finally {
    activeDecodes--;
  }

  if (normalized.data.length > maxStoredMediaBytes) {
    throw new MediaValidationError();
  }

  const key = `${randomUUID()}.${normalized.extension}`;
  const id = randomUUID();

  try {
    await mediaStorage.put(key, normalized.data);
  } catch (error) {
    if (error instanceof AggregateError) {
      logCleanupFailure();
    }

    throw error;
  }

  try {
    return await prisma.media.create({
      data: {
        id,
        key,
        url: `/media/${id}`,
        mime: parsed.mime,
        filename: parsed.filename,
        originalMime: parsed.mime,
        size: normalized.data.length,
        alt: parsed.alt,
        width: normalized.width,
        height: normalized.height,
        uploadedById: actor.id,
      },
      select: libraryMetadata,
    });
  } catch (error) {
    // A lost database response can still mean the row committed.
    try {
      const committed = await prisma.media.findUnique({
        where: { id },
        select: libraryMetadata,
      });

      if (committed) {
        return committed;
      }

      await cleanup(key);
    } catch {
      logCleanupFailure();
    }

    throw error;
  }
}

export async function serveMedia(id: string, actor?: ContentActor) {
  const media = await prisma.media.findUnique({ where: { id } });

  if (!media?.key || !MediaInputMimeSchema.safeParse(media.mime).success) {
    throw new ContentNotFoundError();
  }

  const canManage =
    actor &&
    (isEditor(actor) ||
      (actor.role === "AUTHOR" && media.uploadedById === actor.id));

  if (!canManage) {
    const published = await prisma.page.findMany({
      where: {
        ...publicPublicationWhere(new Date()),
        OR: [
          { coverId: id },
          {
            type: "PAGE",
            layout: "GALLERY",
            gallery: { some: { mediaId: id } },
          },
          { pageDocument: { contains: JSON.stringify(id) } },
        ],
      },
      select: {
        coverId: true,
        type: true,
        layout: true,
        gallery: { where: { mediaId: id }, select: { mediaId: true }, take: 1 },
        pageDocument: true,
      },
    });

    const referenced = published.some((page) => {
      if (
        page.coverId === id ||
        (page.type === "PAGE" &&
          page.layout === "GALLERY" &&
          page.gallery.length)
      ) {
        return true;
      }

      const document = page.pageDocument
        ? readPageDocument(page.pageDocument)
        : null;

      return (
        document?.supported && pageMediaIds(document.document).includes(id)
      );
    });

    if (!referenced) {
      throw new ContentNotFoundError();
    }
  }

  let bytes: Buffer;

  try {
    bytes = await mediaStorage.read(media.key);
  } catch (error) {
    if (missingFile(error)) {
      throw new ContentNotFoundError();
    }

    throw error;
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": media.mime,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}

export async function deleteMedia(id: string, actor: ContentActor) {
  const scope = mediaWriteWhere(actor);

  // Shared with revision writes so reference checks and deletion cannot race.
  const key = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71520261111::bigint)`;
    const media = await tx.media.findUnique({ where: { id } });

    if (!media) {
      throw new ContentNotFoundError();
    }

    if (scope.uploadedById && media.uploadedById !== scope.uploadedById) {
      throw new ContentForbiddenError();
    }

    if (await isMediaReferenced(id, tx)) {
      throw new MediaReferencedError();
    }

    const sharedKey =
      media.key &&
      (await tx.media.count({
        where: { key: media.key, id: { not: id } },
      }));
    await tx.media.delete({ where: { id } });

    return sharedKey ? null : media.key;
  });

  if (!key) {
    return;
  }

  await cleanup(key);
}
