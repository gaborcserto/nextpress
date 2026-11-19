import { internalError, notfound } from "@/lib/api";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { ContentNotFoundError } from "@/lib/auth/content-access";
import { serveMedia } from "@/lib/services/media.server";

async function get(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await serveMedia((await ctx.params).id);
  } catch (error) {
    return error instanceof ContentNotFoundError
      ? notfound()
      : internalError(error);
  }
}

export const GET = withRequestLogging("public.media", get);
