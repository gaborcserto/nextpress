import { ZodError } from "zod";

import { bad, ok, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import {
  listMedia,
  uploadMedia,
  MediaValidationError,
} from "@/lib/services/media.server";

export const GET = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (_req, _ctx, { session }) => {
    try {
      return ok(await listMedia(session.user));
    } catch {
      return oops();
    }
  },
);

export const POST = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req, _ctx, { session }) => {
    try {
      const media = await uploadMedia(await req.json(), session.user);
      console.info(
        JSON.stringify({
          event: "media.uploaded",
          actorId: session.user.id,
          targetId: media.id,
        }),
      );

      return ok(media, 201);
    } catch (error) {
      if (
        error instanceof ZodError ||
        error instanceof MediaValidationError ||
        error instanceof SyntaxError
      )
        return bad("Invalid image upload");

      return oops();
    }
  },
  "create-content",
);
