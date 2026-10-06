import { ok, bad, notfound, conflict, oops, forbid } from "@/lib/api";
import { getSessionWithRole, withAuth } from "@/lib/auth/auth-server";
import { ContentForbiddenError, ContentNotFoundError } from "@/lib/auth/content-access";
import type { PostFormValues } from "@/lib/content/contracts";
import { normalizeSlateValue } from "@/lib/content/editor";
import { TaxonomyScopeError } from "@/lib/repos/tagRepo";
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

export const runtime = "nodejs";

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
    const { item, tags } = await getPostWithTagsService(id, (await getSessionWithRole())?.user);

    const formItem = mapPostToFormValues(item, tags);

    return ok({ item: formItem });
  } catch (err) {
    if (err instanceof PageNotFoundError) {
      return notfound();
    }
    console.error("GET /api/post/[id] failed");
    return oops();
  }
}

/**
 * PUT /api/post/[id]
 */
export const PUT = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req, ctx, { session }) => {
    const { id } = ctx.params;
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON");
    }

    try {
      const updated = await updatePostService(id, body, session.user);
      return ok(updated);
    } catch (err) {
      if (err instanceof ContentForbiddenError) return forbid();
      if (err instanceof ContentNotFoundError) return notfound();
      if (err instanceof TaxonomyScopeError) return bad(err.message);
      if (err instanceof PageValidationError) {
        return bad(err.message, { issues: err.issues });
      }
      if (err instanceof PageConflictError) {
        return conflict(err.message);
      }

      console.error("PUT /api/post/[id] failed");
      return oops();
    }
  },
  "content"
);

/**
 * DELETE /api/post/[id]
 */
export const DELETE = withAuth(
  ["ADMIN", "EDITOR"],
  async (_req, ctx, { session }) => {
    const { id } = ctx.params;

    try {
      await deletePostService(id, session.user);
      return ok({ ok: true });
    } catch (err) {
      if (err instanceof ContentForbiddenError) return forbid();
      if (err instanceof ContentNotFoundError) return notfound();

      console.error("DELETE /api/post/[id] failed");
      return oops();
    }
  },
  "content"
);
