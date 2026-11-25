import { beforeEach, expect, it, vi } from "vitest";

import { listRevisions } from "./revisions.server";

const { pageFindFirst, revisionFindMany } = vi.hoisted(() => ({
  pageFindFirst: vi.fn(),
  revisionFindMany: vi.fn(),
}));

vi.mock("@nextpress/db/src/client", () => ({
  prisma: {
    page: { findFirst: pageFindFirst },
    pageRevision: { findMany: revisionFindMany },
  },
}));

const actor = { id: "owner", role: "AUTHOR" as const };

beforeEach(() => {
  vi.resetAllMocks();
  pageFindFirst.mockResolvedValue({
    workingVersion: 5,
    title: "Working title",
    slug: "working-title",
    content: "{}",
    excerpt: null,
    layout: "STANDARD",
    pageDocument: null,
    publishedAt: null,
    updatedAt: new Date("2026-11-25T10:00:00Z"),
    cover: null,
    gallery: [],
    listingTaxonomy: null,
  });
  revisionFindMany.mockResolvedValue([
    {
      id: "saved-revision",
      workingVersion: 3,
      createdAt: new Date("2026-11-24T10:00:00Z"),
      title: "Saved title",
      author: { name: "Editor" },
    },
  ]);
});

it("returns the current update time and saved revision author name", async () => {
  const result = await listRevisions("page", actor);

  expect(result.current.updatedAt).toEqual(new Date("2026-11-25T10:00:00Z"));
  expect(result.revisions[0]).toMatchObject({
    id: "saved-revision",
    authorName: "Editor",
  });
  expect(result.revisions[0]).not.toHaveProperty("author");
  expect(revisionFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      include: { author: { select: { name: true } } },
    }),
  );
});
