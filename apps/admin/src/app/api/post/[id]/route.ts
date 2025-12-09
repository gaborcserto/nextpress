export const runtime = "nodejs";

import { ok, bad, notfound, conflict, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import {
  PageValidationError,
  PageConflictError,
  PageNotFoundError,
} from "@/lib/services/content.shared";
import {
  getPostWithTagsService,
  updatePostService,
  deletePostService,
} from "@/lib/services/post.server";

type RouteParams = { id: string };
type RawParams = Record<string, string>;
type ParamsLike = RawParams | Promise<RawParams>;

/**
 * Normalize Next.js params (can be plain object or Promise).
 */
async function getRouteParams(params: ParamsLike): Promise<RouteParams> {
  const p = await params;
  return { id: p.id };
}

/**
 * GET /api/post/[id]
 */
export async function GET(
  _req: Request,
  ctx: { params: ParamsLike }
) {
  try {
    const { id } = await getRouteParams(ctx.params);
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
    const { id } = await getRouteParams(
      ctx.params as ParamsLike
    );

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON");
    }

    try {
      const updated = await updatePostService(id, body);
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
    const { id } = await getRouteParams(
      ctx.params as ParamsLike
    );

    try {
      await deletePostService(id);
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
