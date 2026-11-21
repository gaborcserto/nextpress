import { readRichContent } from "@nextpress/shared/content";
import { readPageDocument } from "@nextpress/shared/page-document";

import { ok, bad, notfound, oops } from "@/lib/api";
import { contentMutationError } from "@/lib/api/content-mutation-error";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { getSessionWithRole, withAuth } from "@/lib/auth/auth-server";
import { isEditor } from "@/lib/auth/content-access";
import { PageNotFoundError } from "@/lib/services/content.shared";
import {
  getPostWithTagsService,
  updatePostService,
  deletePostService,
} from "@/lib/services/post.server";

import type { EditorialPost } from "@nextpress/shared/api-contracts";

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
  tags: Awaited<ReturnType<typeof getPostWithTagsService>>["tags"],
  editable: boolean,
): EditorialPost {
  const document = page.pageDocument
    ? readPageDocument(page.pageDocument)
    : null;

  return {
    workingVersion: page.workingVersion,
    status: page.status,
    slug: page.slug,
    title: page.title,
    pageDocument: document?.supported
      ? document.document
      : document === null
        ? null
        : undefined,
    excerpt: readRichContent(page.excerpt).blocks,
    content: readRichContent(page.content).blocks,
    tags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
    })),
    cover:
      page.cover &&
      (editable
        ? page.cover
        : {
            id: page.cover.id,
            url: page.cover.url,
            alt: page.cover.alt,
          }),
    publishedAt: page.publishedAt ? page.publishedAt.toISOString() : null,
  };
}

/**
 * GET /api/post/[id]
 */
async function get(_req: Request, { params }: GetContext) {
  try {
    const { id } = await params;
    const actor = (await getSessionWithRole())?.user;
    const { item, tags } = await getPostWithTagsService(id, actor);

    const editable =
      isEditor(actor) ||
      (actor?.role === "AUTHOR" && item.authorId === actor.id);

    const formItem = mapPostToFormValues(item, tags, editable);

    return ok({ item: formItem });
  } catch (err) {
    if (err instanceof PageNotFoundError) {
      return notfound();
    }

    return oops(err);
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
      return contentMutationError(err, "update");
    }
  },
  "content",
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
      return contentMutationError(err, "delete");
    }
  },
  "content",
);

export const GET = withRequestLogging("content", get);
