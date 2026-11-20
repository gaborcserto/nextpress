import { prisma } from "@nextpress/db/src/client";

import { ok, bad } from "@/lib/api";
import { contentMutationError } from "@/lib/api/content-mutation-error";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { getSessionWithRole, withAuth } from "@/lib/auth/auth-server";
import { contentReadWhere } from "@/lib/auth/content-access";
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
      return contentMutationError(err, "create");
    }
  },
  "create-content",
);

/**
 * GET /api/pages
 */
async function get(req: Request) {
  const actor = (await getSessionWithRole())?.user;
  const url = new URL(req.url);
  const selectMode = url.searchParams.get("select");

  if (url.searchParams.getAll("select").length > 1) {
    return bad("Invalid selector");
  }

  if (selectMode === "parent") {
    const pages = await prisma.page.findMany({
      where: { type: "PAGE", ...contentReadWhere(actor) },
      orderBy: { title: "asc" },
      take: 500,
      select: { id: true, title: true, parentId: true },
    });

    return ok(pages);
  }

  if (selectMode !== null) {
    return bad("Invalid selector");
  }

  const pagination = parsePagination(url.searchParams);

  if (!pagination) {
    return bad("Invalid pagination");
  }

  const result = await listPagesService(
    pagination.page,
    pagination.limit,
    actor,
  );

  return ok(result);
}

export const GET = withRequestLogging("content", get);
