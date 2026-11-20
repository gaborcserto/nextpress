import { ok, bad } from "@/lib/api";
import { contentMutationError } from "@/lib/api/content-mutation-error";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { getSessionWithRole, withAuth } from "@/lib/auth/auth-server";
import {
  createPostService,
  listPostsService,
} from "@/lib/services/post.server";
import { parsePagination } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * POST /api/post
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
      const created = await createPostService(body, session.user);

      return ok(created, 201);
    } catch (err) {
      return contentMutationError(err, "create");
    }
  },
  "create-content",
);

/**
 * GET /api/post
 */
async function get(req: Request) {
  const actor = (await getSessionWithRole())?.user;
  const url = new URL(req.url);

  const pagination = parsePagination(url.searchParams);

  if (!pagination) {
    return bad("Invalid pagination");
  }

  const result = await listPostsService(
    pagination.page,
    pagination.limit,
    actor,
  );

  return ok(result);
}

export const GET = withRequestLogging("content", get);
