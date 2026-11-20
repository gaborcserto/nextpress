import { readRichContent } from "@nextpress/shared/content";

import { ok, bad, notfound, internalError } from "@/lib/api";
import { contentMutationError } from "@/lib/api/content-mutation-error";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { getSessionWithRole, withAuth } from "@/lib/auth/auth-server";
import { getPageById, getTagsForPage } from "@/lib/repos";
import {
  deletePageService,
  updatePageService,
} from "@/lib/services/page.server";

import type { EditorialPage } from "@nextpress/shared/api-contracts";

export const runtime = "nodejs";

type RouteParams = { id: string };

function mapPageToFormValues(
  page: NonNullable<Awaited<ReturnType<typeof getPageById>>>,
  tags: Awaited<ReturnType<typeof getTagsForPage>>,
): EditorialPage {
  return {
    workingVersion: page.workingVersion,
    type: page.layout,
    status: page.status,
    publishedAt: page.publishedAt?.toISOString() ?? null,
    slug: page.slug,
    title: page.title,
    content: readRichContent(page.content).blocks,
    tags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
    })),
    parentId: page.parentId,
    inHeaderMenu: page.inHeaderMenu,
    inFooterMenu: page.inFooterMenu,
    listingKind: page.listingKind,
    listingTaxonomyId: page.listingTaxonomyId,
    ...(page.listingTaxonomy ? { listingTag: page.listingTaxonomy } : {}),
    eventStart: page.eventStart?.toISOString() ?? null,
    eventEnd: page.eventEnd?.toISOString() ?? null,
    eventLocation: page.eventLocation,
    registrationUrl: page.registrationUrl,
    redirectTo: page.redirectTo,
  };
}

type GetContext = {
  params: Promise<RouteParams>;
};

/**
 * GET /api/pages/[id]
 */
async function get(_req: Request, { params }: GetContext) {
  try {
    const { id } = await params;

    const actor = (await getSessionWithRole())?.user;
    const page = await getPageById(id, { actor });

    if (!page) {
      return notfound();
    }

    const tags = await getTagsForPage(page.id);
    const item = mapPageToFormValues(page, tags);

    return ok({ item });
  } catch (error) {
    return internalError(error);
  }
}

/**
 * PUT /api/pages/[id]
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
      const updated = await updatePageService(id, body, session.user);

      return ok(updated);
    } catch (err) {
      return contentMutationError(err, "update");
    }
  },
  "content",
);

/**
 * DELETE /api/pages/[id]
 */
export const DELETE = withAuth(
  ["ADMIN", "EDITOR"],
  async (_req, ctx, { session }) => {
    const { id } = ctx.params;

    try {
      await deletePageService(id, session.user);

      return ok({ ok: true });
    } catch (err) {
      return contentMutationError(err, "delete");
    }
  },
  "content",
);

export const GET = withRequestLogging("content", get);
