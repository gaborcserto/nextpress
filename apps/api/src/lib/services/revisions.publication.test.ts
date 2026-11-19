import { EMPTY_RICH_CONTENT } from "@nextpress/shared/content";
import { beforeEach, expect, it, vi } from "vitest";

import { ContentNotFoundError } from "@/lib/auth/content-access";

import { revisionAction, RevisionConflictError } from "./revisions.server";

const { tx } = vi.hoisted(() => ({
  tx: {
    $executeRaw: vi.fn(),
    page: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    pageRevision: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@nextpress/db/src/client", () => ({
  prisma: { $transaction: async (run: (db: typeof tx) => unknown) => run(tx) },
}));
const actor = { id: "owner", role: "AUTHOR" as const };
const publishedAt = new Date("2099-01-01T00:00:00Z");
const input = {
  expectedVersion: 4,
  revisionId: "revision",
  action: "publish" as const,
};

beforeEach(() => {
  vi.resetAllMocks();
  tx.page.findFirst.mockResolvedValue({
    status: "PUBLISHED",
    publishedAt,
    updatedAt: new Date("2026-01-01"),
  });
  tx.page.updateMany.mockResolvedValue({ count: 1 });
  tx.page.update.mockResolvedValue({ id: "page" });
  tx.pageRevision.findFirst.mockResolvedValue({
    id: "revision",
    title: "Revision",
    slug: "revision",
    content: EMPTY_RICH_CONTENT,
    excerpt: EMPTY_RICH_CONTENT,
    layout: "STANDARD",
    pageDocument: null,
  });
});

it("publishes a revision without prematurely exposing a scheduled item", async () => {
  await revisionAction("page", input, actor);
  expect(tx.page.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: "PUBLISHED", publishedAt }),
    }),
  );
  expect(tx.page.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "page", authorId: "owner", workingVersion: 4 },
    }),
  );
});

it("does not publish on a stale revision token", async () => {
  tx.page.updateMany.mockResolvedValue({ count: 0 });
  await expect(revisionAction("page", input, actor)).rejects.toBeInstanceOf(
    RevisionConflictError,
  );
  expect(tx.page.update).not.toHaveBeenCalled();
});

it("does not access another author's revision", async () => {
  tx.page.findFirst.mockResolvedValue(null);
  await expect(revisionAction("page", input, actor)).rejects.toBeInstanceOf(
    ContentNotFoundError,
  );
  expect(tx.pageRevision.findFirst).not.toHaveBeenCalled();
});

it("rejects publishing a malformed historical snapshot before writes", async () => {
  tx.pageRevision.findFirst.mockResolvedValue({ title: "", slug: "valid" });
  await expect(revisionAction("page", input, actor)).rejects.toThrow();
  expect(tx.page.updateMany).not.toHaveBeenCalled();
  expect(tx.page.update).not.toHaveBeenCalled();
});
