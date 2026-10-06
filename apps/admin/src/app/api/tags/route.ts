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

function getTagName(body: unknown): string {
  if (typeof body !== "object" || body === null || !("name" in body)) {
    return "";
  }

  return typeof body.name === "string" ? body.name : "";
}

/**
 * GET /api/tags?query=foo
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "";
  if (query.length > 200) return bad("Search query is too long");

  try {
    const tags = await searchTagsService(query);
    return ok(tags);
  } catch (err) {
    console.error("GET /api/tags failed");

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
export const POST = withAuth(["ADMIN", "EDITOR", "AUTHOR"], async (req) => {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }

  const name = getTagName(body);

  try {
    const tag = await createTagService(name);
    return ok(tag, 201);
  } catch (err) {
    console.error("POST /api/tags failed");

    if (err instanceof ValidationError) {
      return bad(err.message); // 400
    }

    return oops();
  }
}, "taxonomy");

/**
 * DELETE /api/tags?id=123
 */
export const DELETE = withAuth(["ADMIN", "EDITOR"], async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (id.trim().length > 64) return bad("Invalid tag ID");

  try {
    await deleteTagService(id);
    return ok({ message: "Deleted successfully" });
  } catch (err) {
    console.error("DELETE /api/tags failed");

    if (err instanceof ValidationError) {
      return bad(err.message); // 400
    }

    if (err instanceof NotFoundError) {
      return notfound(err.message); // 404 helper
    }

    return oops();
  }
}, "taxonomy");
