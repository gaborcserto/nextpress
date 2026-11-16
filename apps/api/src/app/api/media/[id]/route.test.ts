import { beforeEach, describe, expect, it, vi } from "vitest";

const { removeMedia } = vi.hoisted(() => ({ removeMedia: vi.fn() }));

vi.mock("@nextpress/db/src/client", () => ({ prisma: {} }));

vi.mock("@/lib/auth/auth-server", () => ({
  getSessionWithRole: vi.fn(),
  withAuth:
    (
      _roles: string[],
      handler: (
        request: Request,
        context: { params: { id: string } },
        auth: { session: { user: { id: string; role: "AUTHOR" } } },
      ) => Promise<Response>,
    ) =>
    async (request: Request, context: { params: Promise<{ id: string }> }) =>
      handler(
        request,
        { params: await context.params },
        {
          session: { user: { id: "author", role: "AUTHOR" } },
        },
      ),
}));

vi.mock("@/lib/services/media.server", () => ({
  deleteMedia: removeMedia,
  serveMedia: vi.fn(),
  MediaReferencedError: class extends Error {},
}));

import { ContentNotFoundError } from "@/lib/auth/content-access";

import { DELETE } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("media DELETE response", () => {
  it("keeps the success response and returns not found on a repeated deletion", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    removeMedia
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ContentNotFoundError());
    const request = new Request("http://localhost/api/media/asset", {
      method: "DELETE",
    });
    const context = { params: Promise.resolve({ id: "asset" }) };
    const first = await DELETE(request, context);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });
    const second = await DELETE(request, context);
    expect(second.status).toBe(404);
    vi.restoreAllMocks();
  });
});
