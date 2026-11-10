import "server-only";

import { prisma } from "@nextpress/db/src/client";
import {
  pageMediaIds,
  readPageDocument,
  serializePageDocument,
} from "@nextpress/shared/page-document";
import {
  RevisionActionSchema,
  RevisionInputSchema,
} from "@nextpress/shared/revisions";

import {
  contentWriteWhere,
  ContentNotFoundError,
  type ContentActor,
} from "@/lib/auth/content-access";

export class RevisionConflictError extends Error {}

export async function listRevisions(pageId: string, actor: ContentActor) {
  const page = await prisma.page.findFirst({
    where: { id: pageId, ...contentWriteWhere(actor) },
    select: {
      workingVersion: true,
      title: true,
      slug: true,
      content: true,
      excerpt: true,
      layout: true,
      pageDocument: true,
    },
  });

  if (!page) throw new ContentNotFoundError();
  const revisions = await prisma.pageRevision.findMany({
    where: { pageId },
    orderBy: [{ workingVersion: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return { version: page.workingVersion, current: page, revisions };
}

export async function saveRevision(
  pageId: string,
  input: unknown,
  actor: ContentActor,
) {
  const parsed = RevisionInputSchema.parse(input);
  const scope = contentWriteWhere(actor);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71520261111::bigint)`;
    const current = await tx.page.findFirst({
      where: { id: pageId, ...scope },
      select: { updatedAt: true },
    });

    if (!current) throw new ContentNotFoundError();
    const mediaIds = parsed.pageDocument
      ? pageMediaIds(parsed.pageDocument)
      : [];
    const mediaCount = await tx.media.count({
      where: {
        id: { in: mediaIds },
        ...(actor.role === "AUTHOR" ? { uploadedById: actor.id } : {}),
      },
    });

    if (mediaCount !== mediaIds.length) throw new ContentNotFoundError();
    const changed = await tx.page.updateMany({
      where: { id: pageId, ...scope, workingVersion: parsed.expectedVersion },
      data: { workingVersion: { increment: 1 }, updatedAt: current.updatedAt },
    });

    if (!changed.count) throw new RevisionConflictError();

    return tx.pageRevision.create({
      data: {
        pageId,
        authorId: actor.id,
        workingVersion: parsed.expectedVersion + 1,
        title: parsed.title,
        slug: parsed.slug,
        excerpt: parsed.excerpt,
        content: parsed.content,
        layout: parsed.layout,
        pageDocument: parsed.pageDocument
          ? serializePageDocument(parsed.pageDocument)
          : null,
        status: "DRAFT",
        publishedAt: null,
      },
    });
  });
}

export async function revisionAction(
  pageId: string,
  input: unknown,
  actor: ContentActor,
) {
  const parsed = RevisionActionSchema.parse(input);
  const scope = contentWriteWhere(actor);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71520261111::bigint)`;
    const current = await tx.page.findFirst({
      where: { id: pageId, ...scope },
      select: { updatedAt: true },
    });

    if (!current) throw new ContentNotFoundError();
    const revision = await tx.pageRevision.findFirst({
      where: { id: parsed.revisionId, pageId },
    });

    if (!revision) throw new ContentNotFoundError();
    if (
      revision.pageDocument &&
      !readPageDocument(revision.pageDocument).supported
    )
      throw new RevisionConflictError();
    const changed = await tx.page.updateMany({
      where: { id: pageId, ...scope, workingVersion: parsed.expectedVersion },
      data: { workingVersion: { increment: 1 }, updatedAt: current.updatedAt },
    });

    if (!changed.count) throw new RevisionConflictError();
    const snapshot = {
      title: revision.title,
      slug: revision.slug,
      excerpt: revision.excerpt,
      content: revision.content,
      layout: revision.layout,
      pageDocument: revision.pageDocument,
    };

    if (parsed.action === "restore") {
      return tx.pageRevision.create({
        data: {
          ...snapshot,
          pageId,
          authorId: actor.id,
          workingVersion: parsed.expectedVersion + 1,
          status: "DRAFT",
          publishedAt: null,
          note: `Restored from ${revision.id}`,
        },
      });
    }
    if (parsed.action === "unpublish")
      return tx.page.update({
        where: { id: pageId },
        data: { status: "DRAFT" },
      });

    return tx.page.update({
      where: { id: pageId },
      data: { ...snapshot, status: "PUBLISHED", publishedAt: new Date() },
    });
  });
}

export async function previewRevision(
  pageId: string,
  revisionId: string,
  actor: ContentActor,
) {
  await listRevisions(pageId, actor);
  const revision = await prisma.pageRevision.findFirst({
    where: { id: revisionId, pageId },
  });

  if (!revision) throw new ContentNotFoundError();

  return revision;
}
