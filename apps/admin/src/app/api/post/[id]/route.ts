export const runtime = "nodejs";

import { ok, bad, notfound, conflict, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import type { PostFormValues } from "@/lib/content/contracts";
import { normalizeSlateValue } from "@/lib/content/editor";
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

type GetContext = {
  params: Promise<RouteParams>;
};

/**
 * Map DB entity + tags into PostFormValues used by the form.
 */
function mapPostToFormValues(
  page: Awaited<ReturnType<typeof getPostWithTagsService>>["item"],
  tags: Awaited<ReturnType<typeof getPostWithTagsService>>["tags"]
): PostFormValues {
  return {
    status: page.status,
    slug: page.slug,
    title: page.title,
    excerpt: normalizeSlateValue(page.excerpt),
    content: normalizeSlateValue(page.content),
    tags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
    })),
    // TODO: map cover once it's stored on the Page
    cover: null,
    publishedAt: page.publishedAt
      ? page.publishedAt.toISOString().slice(0, 16)
      : null,
  };
}

/**
 * GET /api/post/[id]
 */
export async function GET(_req: Request, { params }: GetContext) {
  try {
    const { id } =  await params;
    const { item, tags } = await getPostWithTagsService(id);

    const formItem = mapPostToFormValues(item, tags);

    return ok({ item: formItem });
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
    const { id } = ctx.params;
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
    const { id } = ctx.params;

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
