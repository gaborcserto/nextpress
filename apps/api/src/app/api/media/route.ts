import { writeServerLog } from "@nextpress/shared/server-logging";
import { ZodError } from "zod";

import { bad, ok, oops } from "@/lib/api";
import { apiLogContext } from "@/lib/api/request-log-context.server";
import { withAuth } from "@/lib/auth/auth-server";
import { tooManyRequests } from "@/lib/security/rate-limit.server";
import { UnsupportedMediaAnimationError } from "@/lib/services/media-image.server";
import {
  listMedia,
  uploadMedia,
  MediaValidationError,
  MediaBusyError,
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
      writeServerLog("api", "media.uploaded", {
        ...apiLogContext(),
        actorId: session.user.id,
        targetId: media.id,
      });

      return ok(media, 201);
    } catch (error) {
      if (error instanceof MediaBusyError) {
        return tooManyRequests(1);
      }

      if (error instanceof UnsupportedMediaAnimationError) {
        return bad("Unsupported image animation");
      }

      if (
        error instanceof ZodError ||
        error instanceof MediaValidationError ||
        error instanceof SyntaxError
      ) {
        return bad("Invalid image upload");
      }

      return oops(error);
    }
  },
  "create-content",
);
