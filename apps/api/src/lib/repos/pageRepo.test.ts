import { afterEach, describe, expect, it, vi } from "vitest";

const page = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@nextpress/db/src/client", () => ({
  prisma: {
    $transaction: (run: (tx: { page: typeof page }) => unknown) =>
      run({ page }),
  },
}));

import { listPages } from "./pageRepo";

const now = new Date("2026-11-20T12:00:00.000Z");

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe.each([
  ["PAGE", "PAGE"],
  ["POST", "POST"],
] as const)("%s editorial publication projection", (type, filter) => {
  it("returns persisted timestamps and API-clock states for each publication condition", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    page.findMany.mockResolvedValue([
      { id: "draft", status: "DRAFT", publishedAt: now },
      {
        id: "past",
        status: "PUBLISHED",
        publishedAt: new Date(now.getTime() - 1),
      },
      { id: "exact", status: "PUBLISHED", publishedAt: now },
      {
        id: "future",
        status: "PUBLISHED",
        publishedAt: new Date(now.getTime() + 1),
      },
      { id: "undated", status: "PUBLISHED", publishedAt: null },
    ]);
    page.count.mockResolvedValue(5);

    const result = await listPages(0, 50, {
      type: filter,
      actor: { id: "editor", role: "EDITOR" },
    });

    expect(result.items).toEqual([
      {
        id: "draft",
        status: "DRAFT",
        publishedAt: now,
        authorName: null,
        publicationState: "DRAFT",
      },
      {
        id: "past",
        status: "PUBLISHED",
        publishedAt: new Date(now.getTime() - 1),
        authorName: null,
        publicationState: "PUBLISHED",
      },
      {
        id: "exact",
        status: "PUBLISHED",
        publishedAt: now,
        authorName: null,
        publicationState: "PUBLISHED",
      },
      {
        id: "future",
        status: "PUBLISHED",
        publishedAt: new Date(now.getTime() + 1),
        authorName: null,
        publicationState: "SCHEDULED",
      },
      {
        id: "undated",
        status: "PUBLISHED",
        publishedAt: null,
        authorName: null,
        publicationState: "MISSING_DATE",
      },
    ]);
    expect(page.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: filter },
        select: expect.objectContaining({
          publishedAt: true,
          author: { select: { name: true } },
        }),
      }),
    );
    expect(page.count).toHaveBeenCalledWith({ where: { type: filter } });
  });

  it("projects only the explicit author's display name and supports author ordering", async () => {
    page.findMany.mockResolvedValue([
      {
        id: "owned",
        type,
        layout: "STANDARD",
        status: "DRAFT",
        publishedAt: null,
        slug: "owned",
        title: "Owned",
        excerpt: null,
        author: { name: "Editorial Writer" },
        createdAt: now,
        updatedAt: now,
      },
    ]);
    page.count.mockResolvedValue(1);

    const result = await listPages(0, 10, {
      type: filter,
      filters: { sort: "author", direction: "asc" },
    });

    expect(result.items[0].authorName).toBe("Editorial Writer");
    expect(result.items[0]).not.toHaveProperty("author");
    expect(page.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ author: { name: "asc" } }, { id: "asc" }],
      }),
    );
  });
});
