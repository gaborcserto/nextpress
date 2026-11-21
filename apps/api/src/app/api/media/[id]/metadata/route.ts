import { MediaEditSchema, MediaIdSchema } from "@nextpress/shared/media";

import { bad, notfound, ok, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import { ContentNotFoundError } from "@/lib/auth/content-access";
import { editMedia, mediaDetails } from "@/lib/services/media-library.server";

export const GET = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (_req, { params }, { session }) => {
    if (!MediaIdSchema.safeParse(params.id).success) {
      return notfound();
    }

    try {
      return ok(await mediaDetails(params.id, session.user));
    } catch (error) {
      return error instanceof ContentNotFoundError ? notfound() : oops(error);
    }
  },
);

export const PATCH = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req, { params }, { session }) => {
    if (!MediaIdSchema.safeParse(params.id).success) {
      return notfound();
    }

    try {
      const changes = MediaEditSchema.safeParse(await req.json());

      if (!changes.success) {
        return bad("Invalid media metadata");
      }

      return ok(await editMedia(params.id, changes.data, session.user));
    } catch (error) {
      if (error instanceof SyntaxError) {
        return bad("Invalid media metadata");
      }

      return error instanceof ContentNotFoundError ? notfound() : oops(error);
    }
  },
  "create-content",
);
