import { prisma } from "@nextpress/db/src/client";

import { ok, bad, conflict, oops, forbid } from "@/lib/api";
import { getSessionWithRole, withAuth } from "@/lib/auth/auth-server";
import { ContentForbiddenError, contentReadWhere } from "@/lib/auth/content-access";
import { TaxonomyScopeError } from "@/lib/repos/tagRepo";
import {
  PageValidationError,
  PageConflictError,
} from "@/lib/services/content.shared";
import {
  createPageService,
  listPagesService,
} from "@/lib/services/page.server";
import { parsePagination } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * POST /api/pages
 */
export const POST = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req, _ctx, { session }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON");
    }

    try {
      const created = await createPageService(body, session.user);
      return ok(created, 201);
    } catch (err) {
      if (err instanceof ContentForbiddenError) return forbid();
      if (err instanceof TaxonomyScopeError) return bad(err.message);
      if (err instanceof PageValidationError) {
        return bad(err.message, { issues: err.issues });
      }
      if (err instanceof PageConflictError) {
        return conflict(err.message);
      }

      console.error("POST /api/pages failed");
      return oops();
    }
  }
);

/**
 * GET /api/pages
 */
export async function GET(req: Request) {
  const actor = (await getSessionWithRole())?.user;
  const url = new URL(req.url);
  const selectMode = url.searchParams.get("select");
  if (url.searchParams.getAll("select").length > 1) return bad("Invalid selector");

  if (selectMode === "parent") {
    const pages = await prisma.page.findMany({
      where: { type: "PAGE", ...contentReadWhere(actor) },
      orderBy: { title: "asc" },
      take: 500,
      select: { id: true, title: true, parentId: true },
    });

    return ok(pages);
  }

  if (selectMode !== null) return bad("Invalid selector");

  const pagination = parsePagination(url.searchParams);
  if (!pagination) return bad("Invalid pagination");

  const result = await listPagesService(pagination.page, pagination.limit, actor);
  return ok(result);
}
