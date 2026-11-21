import { prisma } from "@nextpress/db/src/client";

import {
  contentWriteWhere,
  type ContentActor,
} from "@/lib/auth/content-access";
import {
  editorialPublicationState,
  editorialPublicationWhere,
} from "@/lib/publication";

import type { DashboardSummary } from "@nextpress/shared/api-contracts";

const contentSelect = { id: true, type: true, title: true } as const;
const listLimit = 8;

export async function getDashboardSummary(
  actor: ContentActor,
  now = new Date(),
): Promise<DashboardSummary> {
  const scope = contentWriteWhere(actor);
  const published = {
    ...scope,
    ...editorialPublicationWhere("PUBLISHED", now),
  };
  const scheduled = {
    ...scope,
    ...editorialPublicationWhere("SCHEDULED", now),
  };
  const totalsQuery = prisma.page.groupBy({
    by: ["type", "status"],
    where: scope,
    _count: { _all: true },
  });
  const publishedQuery = prisma.page.groupBy({
    by: ["type"],
    where: published,
    _count: { _all: true },
  });

  // Counts and lists describe the same editorial snapshot during concurrent saves.
  const [totals, live, scheduledCount, recent, queue] =
    await prisma.$transaction(
      [
        totalsQuery,
        publishedQuery,
        prisma.page.count({ where: scheduled }),
        prisma.page.findMany({
          where: scope,
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          take: listLimit,
          select: {
            ...contentSelect,
            updatedAt: true,
            publishedAt: true,
            status: true,
            author: { select: { name: true } },
          },
        }),
        prisma.page.findMany({
          where: scheduled,
          orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
          take: listLimit,
          select: { ...contentSelect, publishedAt: true },
        }),
      ],
      { isolationLevel: "RepeatableRead" },
    );

  const posts = { total: 0, published: 0 };
  const pages = { total: 0, published: 0 };
  let drafts = 0;

  for (const row of totals) {
    const collection = row.type === "POST" ? posts : pages;
    collection.total += row._count._all;

    if (row.status === "DRAFT") {
      drafts += row._count._all;
    }
  }

  for (const row of live) {
    const collection = row.type === "POST" ? posts : pages;
    collection.published = row._count._all;
  }

  return {
    posts,
    pages,
    drafts,
    scheduled: scheduledCount,
    missingPublicationDate:
      posts.total +
      pages.total -
      drafts -
      scheduledCount -
      posts.published -
      pages.published,
    recentContent: recent.map(
      ({ updatedAt, status, publishedAt, author, ...item }) => ({
        ...item,
        updatedAt: updatedAt.toISOString(),
        publicationState: editorialPublicationState(status, publishedAt, now),
        authorName: author?.name ?? null,
      }),
    ),
    scheduledContent: queue.flatMap(({ publishedAt, ...item }) =>
      publishedAt ? [{ ...item, publishedAt: publishedAt.toISOString() }] : [],
    ),
  };
}
