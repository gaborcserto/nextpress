import { expect, it, vi } from "vitest";

import { PUT as updatePage } from "@/app/api/pages/[id]/route";
import { GET as getPages, POST as createPage } from "@/app/api/pages/route";
import { PUT as updatePost } from "@/app/api/post/[id]/route";
import { POST as createPost } from "@/app/api/post/route";
import { listPagesService } from "@/lib/services/page.server";

import type { ContentActor } from "@/lib/auth/content-access";

const actor: ContentActor = { id: "editor", role: "EDITOR" };

const { findParentOptions } = vi.hoisted(() => ({
  findParentOptions: vi.fn(),
}));

vi.mock("@nextpress/db/src/client", () => ({
  prisma: { page: { findMany: findParentOptions } },
}));
vi.mock("@/lib/services/page.server", () => ({
  createPageService: vi.fn(),
  updatePageService: vi.fn(),
  listPagesService: vi.fn(),
}));
vi.mock("@/lib/services/post.server", () => ({
  createPostService: vi.fn(),
  updatePostService: vi.fn(),
}));
vi.mock("@/lib/auth/auth-server", () => ({
  getSessionWithRole: async () => ({ user: actor }),
  withAuth:
    (
      _roles: string[],
      handler: (
        request: Request,
        context: { params: { id: string } },
        auth: { session: { user: ContentActor } },
      ) => Promise<Response>,
    ) =>
    async (request: Request, context: { params: Promise<{ id: string }> }) =>
      handler(
        request,
        { params: await context.params },
        { session: { user: actor } },
      ),
}));

it.each([
  { name: "Page creation", method: "POST", path: "pages", handler: createPage },
  { name: "Post creation", method: "POST", path: "post", handler: createPost },
  {
    name: "Page update",
    method: "PUT",
    path: "pages/item",
    handler: updatePage,
  },
  {
    name: "Post update",
    method: "PUT",
    path: "post/item",
    handler: updatePost,
  },
])(
  "returns 400 for malformed JSON during $name",
  async ({ method, path, handler }) => {
    const request = new Request(`https://example.test/api/${path}`, {
      method,
      body: "{",
    });

    const response = await handler(request, {
      params: Promise.resolve({ id: "item" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  },
);

it("returns Page parent options independently of list pagination", async () => {
  const parents = [{ id: "parent", title: "Parent", parentId: null }];
  findParentOptions.mockResolvedValueOnce(parents);
  const request = new Request(
    "https://example.test/api/pages?select=parent&page=invalid",
  );

  const response = await getPages(request);

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(parents);
  expect(listPagesService).not.toHaveBeenCalled();
});
