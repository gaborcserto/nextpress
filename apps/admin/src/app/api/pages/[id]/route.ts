import { ok, bad, notfound, conflict, oops, forbid } from "@/lib/api";
import { getSessionWithRole, withAuth } from "@/lib/auth/auth-server";
import { ContentForbiddenError, ContentNotFoundError } from "@/lib/auth/content-access";
import type { PageFormValues } from "@/lib/content/contracts";
import { normalizeSlateValue } from "@/lib/content/editor";
import { getPageById, getTagsForPage } from "@/lib/repos";
import { TaxonomyScopeError } from "@/lib/repos/tagRepo";
import {
  PageValidationError,
  PageConflictError,
} from "@/lib/services/content.shared";
import {
  deletePageService,
  updatePageService,
} from "@/lib/services/page.server";

export const runtime = "nodejs";

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

  const actor = (await getSessionWithRole())?.user;
  const page = await getPageById(id, { actor });
  if (!page) return notfound();

  const tags = await getTagsForPage(page.id);
  const item = mapPageToFormValues(page, tags);

  return ok({ item });
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
      if (err instanceof ContentForbiddenError) return forbid();
      if (err instanceof ContentNotFoundError) return notfound();
      if (err instanceof TaxonomyScopeError) return bad(err.message);
      if (err instanceof PageValidationError) {
        return bad(err.message, { issues: err.issues });
      }
      if (err instanceof PageConflictError) {
        return conflict(err.message);
      }

      console.error("PUT /api/pages/[id] failed");
      return oops();
    }
  }
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
      if (err instanceof ContentForbiddenError) return forbid();
      if (err instanceof ContentNotFoundError) return notfound();

      console.error("DELETE /api/pages/[id] failed");
      return oops();
    }
  }
);
