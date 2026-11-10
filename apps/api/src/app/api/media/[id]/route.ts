import { conflict, forbid, notfound, ok, oops } from "@/lib/api";
import { getSessionWithRole, withAuth } from "@/lib/auth/auth-server";
import {
  ContentForbiddenError,
  ContentNotFoundError,
} from "@/lib/auth/content-access";
import {
  deleteMedia,
  MediaReferencedError,
  serveMedia,
} from "@/lib/services/media.server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    return await serveMedia(
      (await ctx.params).id,
      (await getSessionWithRole())?.user,
    );
  } catch (error) {
    return error instanceof ContentNotFoundError ? notfound() : oops();
  }
}

export const DELETE = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (_req, ctx, { session }) => {
    try {
      await deleteMedia(ctx.params.id, session.user);
      console.info(
        JSON.stringify({
          event: "media.deleted",
          actorId: session.user.id,
          targetId: ctx.params.id,
        }),
      );

      return ok({ ok: true });
    } catch (error) {
      if (error instanceof ContentNotFoundError) return notfound();
      if (error instanceof MediaReferencedError)
        return conflict("Media is referenced by content or revisions");
      if (error instanceof ContentForbiddenError) return forbid();

      return oops();
    }
  },
  "create-content",
);
