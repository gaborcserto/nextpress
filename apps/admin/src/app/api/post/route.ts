export const runtime = "nodejs";

import { ok, bad, conflict, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import {
  createPostService,
  listPostsService,
  PageValidationError,
  PageConflictError,
} from "@/lib/services/page.server";

/**
 * POST /api/post
 */
export const POST = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req, _ctx, { session }) => {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON");
    }

    try {
      const created = await createPostService(body, session.user.id);
      return ok(created, 201);
    } catch (err) {
      if (err instanceof PageValidationError) {
        return bad(err.message, { issues: err.issues });
      }
      if (err instanceof PageConflictError) {
        return conflict(err.message);
      }

      console.error("POST /api/post error:", err);
      return oops();
    }
  }
);

/**
 * GET /api/post
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);

  const result = await listPostsService(page, limit);
  return ok(result);
}
