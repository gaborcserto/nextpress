export const runtime = "nodejs";

import { ok, bad, oops, notfound } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import {
  searchTagsService,
  createTagService,
  deleteTagService,
  ValidationError,
  NotFoundError,
} from "@/lib/services/tag.server";

/**
 * GET /api/tags?query=foo
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "";

  try {
    const tags = await searchTagsService(query);
    return ok(tags);
  } catch (err) {
    console.error("GET /api/tags error:", err);

    if (err instanceof ValidationError) {
      return bad(err.message); // 400 by default
    }

    return oops();
  }
}

/**
 * POST /api/tags
 * Body: { name: string }
 */
export const POST = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req) => {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON");
    }

    const name = (body as { name?: string }).name ?? "";

    try {
      const tag = await createTagService(name);
      return ok(tag, 201);
    } catch (err) {
      console.error("POST /api/tags error:", err);

      if (err instanceof ValidationError) {
        return bad(err.message); // 400
      }

      return oops();
    }
  }
);

/**
 * DELETE /api/tags?id=123
 */
export const DELETE = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req) => {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";

    try {
      await deleteTagService(id);
      return ok({ message: "Deleted successfully" });
    } catch (err) {
      console.error("DELETE /api/tags error:", err);

      if (err instanceof ValidationError) {
        return bad(err.message); // 400
      }

      if (err instanceof NotFoundError) {
        return notfound(err.message); // 404 helper
      }

      return oops();
    }
  }
);
