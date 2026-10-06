import { ok, bad, oops, forbid, notfound } from "@/lib/api";
import { getSessionWithRole, withAuth } from "@/lib/auth/auth-server";
import { ContentForbiddenError, ContentNotFoundError } from "@/lib/auth/content-access";
import { TaxonomyScopeError } from "@/lib/repos/tagRepo";
import {
  getTagsForPageService,
  setTagsForPageService,
  ValidationError,
} from "@/lib/services/tag.server";

export const runtime = "nodejs";

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
    const tags = await getTagsForPageService(entityId, (await getSessionWithRole())?.user);
    return ok(tags);
  } catch (err) {
    if (err instanceof ContentForbiddenError) return forbid();
    if (err instanceof ContentNotFoundError) return notfound();
    if (err instanceof TaxonomyScopeError) return bad(err.message);
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
export const PUT = withAuth(["ADMIN", "EDITOR", "AUTHOR"], async (req, _ctx, { session }) => {
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
  const rawTagIds =
    typeof body === "object" && body !== null && "tagIds" in body
      ? body.tagIds
      : body;

  try {
    await setTagsForPageService(entityId, rawTagIds, session.user);
    return ok({ ok: true });
  } catch (err) {
    if (err instanceof ContentForbiddenError) return forbid();
    if (err instanceof ContentNotFoundError) return notfound();
    if (err instanceof TaxonomyScopeError) return bad(err.message);
    console.error("PUT /api/tags/link error:", err);

    if (err instanceof ValidationError) {
      return bad(err.message);
    }

    return oops();
  }
});
