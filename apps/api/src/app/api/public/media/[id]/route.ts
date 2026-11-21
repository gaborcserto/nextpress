import { MediaIdSchema } from "@nextpress/shared/media";

import { internalError, notfound } from "@/lib/api";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { ContentNotFoundError } from "@/lib/auth/content-access";
import { serveMedia } from "@/lib/services/media.server";

async function get(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!MediaIdSchema.safeParse(id).success) {
    return notfound();
  }

  try {
    return await serveMedia(id);
  } catch (error) {
    return error instanceof ContentNotFoundError
      ? notfound()
      : internalError(error);
  }
}

export const GET = withRequestLogging("public.media", get);
