export const runtime = "nodejs";

import { ok, bad, notfound, conflict, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import type { PageFormValues } from "@/lib/content/contracts";
import { normalizeSlateValue } from "@/lib/content/editor";
import { getPageById, getTagsForPage } from "@/lib/repos";
import {
  PageValidationError,
  PageConflictError,
  PageNotFoundError,
} from "@/lib/services/content.shared";
import {
  deletePageService,
  updatePageService,
} from "@/lib/services/page.server";

type RouteParams = { id: string };

function mapPageToFormValues(
  page: NonNullable<Awaited<ReturnType<typeof getPageById>>>,
  tags: Awaited<ReturnType<typeof getTagsForPage>>
): PageFormValues {
  return {
    type: page.type as PageFormValues["type"],
    status: page.status as PageFormValues["status"],
    slug: page.slug,
    title: page.title,
    content: normalizeSlateValue(page.content),
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
export async function GET(
  _req: Request,
  { params }: GetContext
) {
  const { id } = await params;

  const page = await getPageById(id);
  if (!page) return notfound();

  const tags = await getTagsForPage(id);
  const item = mapPageToFormValues(page, tags);

  return ok({ item });
}

/**
 * PUT /api/pages/[id]
 */
export const PUT = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req, ctx, _auth) => {
    const { id } = ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON");
    }

    try {
      const updated = await updatePageService(id, body);
      return ok(updated);
    } catch (err) {
      if (err instanceof PageValidationError) {
        return bad(err.message, { issues: err.issues });
      }
      if (err instanceof PageConflictError) {
        return conflict(err.message);
      }

      console.error("PUT /api/pages/[id] error:", err);
      return oops();
    }
  }
);

/**
 * DELETE /api/pages/[id]
 */
export const DELETE = withAuth(
  ["ADMIN", "EDITOR"],
  async (_req, ctx, _auth) => {
    const { id } = ctx.params;

    try {
      await deletePageService(id);
      return ok({ ok: true });
    } catch (err) {
      if (err instanceof PageNotFoundError) {
        return notfound();
      }

      console.error("DELETE /api/pages/[id] error:", err);
      return oops();
    }
  }
);
