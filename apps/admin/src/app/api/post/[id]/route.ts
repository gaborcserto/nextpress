export const runtime = "nodejs";

import { ok, bad, notfound, conflict, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import {
  getPostWithTagsService,
  deletePageService,
  updatePageWithTagsService,
  PageValidationError,
  PageConflictError,
  PageNotFoundError,
} from "@/lib/services/page.server";

type RouteParams = { id: string };
type RouteCtx = { params: RouteParams | Promise<RouteParams> };

/**
 * GET /api/post/[id]
 */
export async function GET(
  _req: Request,
  ctx:  RouteCtx
) {
  try {
    const { id } = await ctx.params;
    const { item, tags } = await getPostWithTagsService(id);
    return ok({ item, tags });
  } catch (err) {
    if (err instanceof PageNotFoundError) {
      return notfound();
    }
    console.error("GET /api/post/[id] error:", err);
    return oops();
  }
}

/**
 * PUT /api/post/[id]
 */
export const PUT = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req, ctx) => {
    const { id } = ctx.params as { id: string };
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON");
    }

    try {
      const updated = await updatePageWithTagsService("POST", id, body);
      return ok(updated);
    } catch (err) {
      if (err instanceof PageValidationError) {
        return bad(err.message, { issues: err.issues });
      }
      if (err instanceof PageConflictError) {
        return conflict(err.message);
      }

      console.error("PUT /api/post/[id] error:", err);
      return oops();
    }
  }
);

/**
 * DELETE /api/post/[id]
 */
export const DELETE = withAuth(
  ["ADMIN", "EDITOR"],
  async (_req, ctx) => {
    const { id } = ctx.params;

    try {
      await deletePageService(id);
      return ok({ ok: true });
    } catch (err) {
      if (err instanceof PageNotFoundError) {
        return notfound();
      }

      console.error("DELETE /api/post/[id] error:", err);
      return oops();
    }
  }
);
