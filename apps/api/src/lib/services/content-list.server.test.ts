import { expect, it, vi } from "vitest";

import { listPages } from "@/lib/repos";

import { listPagesService } from "./page.server";
import { listPostsService } from "./post.server";

import type { ContentActor } from "@/lib/auth/content-access";

vi.mock("@nextpress/db/src/client", () => ({ prisma: {} }));
vi.mock("@/lib/repos", async (original) => ({
  ...(await original<typeof import("@/lib/repos")>()),
  listPages: vi.fn(),
}));

const actor: ContentActor = { id: "author", role: "AUTHOR" };

it("bounds page list limits and preserves the Page filter and actor", async () => {
  vi.mocked(listPages).mockResolvedValueOnce({ items: [], total: 201 });

  const result = await listPagesService(-1, 200, actor);

  expect(listPages).toHaveBeenLastCalledWith(0, 100, { type: "PAGE", actor });
  expect(result).toEqual({
    items: [],
    page: 1,
    limit: 100,
    total: 201,
    pages: 3,
  });
});

it("passes the Post filter and offset even when the list is empty", async () => {
  vi.mocked(listPages).mockResolvedValueOnce({ items: [], total: 0 });

  const result = await listPostsService(3, 10, actor);

  expect(listPages).toHaveBeenLastCalledWith(20, 10, { type: "POST", actor });
  expect(result).toEqual({ items: [], page: 3, limit: 10, total: 0, pages: 0 });
});
