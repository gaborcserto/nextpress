import { beforeEach, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    page: {
      groupBy: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock("@nextpress/db/src/client", () => ({ prisma }));

import { getDashboardSummary } from "./dashboardRepo";

beforeEach(() => {
  vi.resetAllMocks();
  prisma.page.groupBy.mockResolvedValue([]);
  prisma.page.count.mockResolvedValue(0);
  prisma.page.findMany.mockResolvedValue([]);
  prisma.$transaction.mockImplementation((queries) => Promise.all(queries));
});

it("queries five recent and scheduled posts or pages in the requested order", async () => {
  const now = new Date("2026-11-23T12:00:00.000Z");
  const recent = Array.from({ length: 5 }, (_, index) => ({
    id: `recent-${index}`,
    type: index % 2 === 0 ? "POST" : "PAGE",
    title: `Recent ${index}`,
    updatedAt: new Date(now.getTime() - index * 1_000),
    publishedAt: null,
    status: "DRAFT",
    author: { name: "Author" },
  }));
  const scheduled = Array.from({ length: 5 }, (_, index) => ({
    id: `scheduled-${index}`,
    type: index % 2 === 0 ? "POST" : "PAGE",
    title: `Scheduled ${index}`,
    publishedAt: new Date(now.getTime() + (index + 1) * 1_000),
  }));
  prisma.page.findMany
    .mockResolvedValueOnce(recent)
    .mockResolvedValueOnce(scheduled);

  const summary = await getDashboardSummary(
    { id: "author", role: "AUTHOR" },
    now,
  );

  const [recentQuery, scheduledQuery] = prisma.page.findMany.mock.calls;
  expect(recentQuery[0]).toMatchObject({
    take: 5,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  expect(scheduledQuery[0]).toMatchObject({
    take: 5,
    where: { status: "PUBLISHED", publishedAt: { gt: now } },
    orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
  });
  expect(summary.recentContent.map(({ id }) => id)).toEqual(
    recent.map(({ id }) => id),
  );
  expect(summary.scheduledContent.map(({ id }) => id)).toEqual(
    scheduled.map(({ id }) => id),
  );
});

it("omits scheduled rows without a publication date and returns empty lists", async () => {
  prisma.page.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
    {
      id: "invalid-schedule",
      type: "POST",
      title: "No date",
      publishedAt: null,
    },
  ]);

  const summary = await getDashboardSummary(
    { id: "admin", role: "ADMIN" },
    new Date("2026-11-23T12:00:00.000Z"),
  );

  expect(summary.recentContent).toEqual([]);
  expect(summary.scheduledContent).toEqual([]);
});
