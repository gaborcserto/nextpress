export const runtime = "nodejs";

import { ok, bad, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import {
  getTagsForPageService,
  setTagsForPageService,
  ValidationError,
} from "@/lib/services/tag.server";

/**
 * GET /api/tags/link?entityId=123
 * Returns tags linked to the given entity (Page/Post).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const entityId = url.searchParams.get("entityId") ?? "";

  if (!entityId.trim()) {
    return bad("Missing entityId");
  }

  try {
    const tags = await getTagsForPageService(entityId);
    return ok(tags);
  } catch (err) {
    console.error("GET /api/tags/link error:", err);

    if (err instanceof ValidationError) {
      return bad(err.message);
    }

    return oops();
  }
}

/**
 * PUT /api/tags/link?entityId=123
 * Body: { tagIds: string[] } (or directly an array)
 * Replaces all tags linked to the given entity (Page/Post).
 */
export const PUT = withAuth(["ADMIN", "EDITOR", "AUTHOR"], async (req) => {
  const url = new URL(req.url);
  const entityId = url.searchParams.get("entityId") ?? "";

  if (!entityId.trim()) {
    return bad("Missing entityId");
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }

  // Allow both payload shapes:
  // 1) { tagIds: [...] }
  // 2) [...]
  const rawTagIds = (body as { tagIds?: unknown })?.tagIds ?? body;

  try {
    await setTagsForPageService(entityId, rawTagIds);
    return ok({ ok: true });
  } catch (err) {
    console.error("PUT /api/tags/link error:", err);

    if (err instanceof ValidationError) {
      return bad(err.message);
    }

    return oops();
  }
});
