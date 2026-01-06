export const runtime = "nodejs";

import { ok, bad, notfound, conflict, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
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
import type { PageFormValues } from "@/ui/layout/PageForm";
import { normalizeSlateValue } from "@/ui/utils/editorForm";

type RouteParams = { id: string };

type PageExtraFields = {
  listingKind?: PageFormValues["listingKind"];
  listingTaxonomyId?: PageFormValues["listingTaxonomyId"];
  eventStart?: PageFormValues["eventStart"];
  eventEnd?: PageFormValues["eventEnd"];
  eventLocation?: PageFormValues["eventLocation"];
  registrationUrl?: PageFormValues["registrationUrl"];
  redirectTo?: PageFormValues["redirectTo"];
};

function getRouteParams(
  ctx: { params: Record<string, string> }
): Promise<RouteParams> {
  return Promise.resolve(
    ctx.params as RouteParams | Promise<RouteParams>
  );
}

function mapPageToFormValues(
  page: NonNullable<Awaited<ReturnType<typeof getPageById>>>,
  tags: Awaited<ReturnType<typeof getTagsForPage>>
): PageFormValues {
  const pageWithExtras = page as typeof page & PageExtraFields;

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
    listingKind: pageWithExtras.listingKind ?? null,
    listingTaxonomyId: pageWithExtras.listingTaxonomyId ?? null,
    eventStart: pageWithExtras.eventStart ?? null,
    eventEnd: pageWithExtras.eventEnd ?? null,
    eventLocation: pageWithExtras.eventLocation ?? null,
    registrationUrl: pageWithExtras.registrationUrl ?? null,
    redirectTo: pageWithExtras.redirectTo ?? null,
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
    const { id } = await getRouteParams(ctx);

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
    const { id } = await getRouteParams(ctx);

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
