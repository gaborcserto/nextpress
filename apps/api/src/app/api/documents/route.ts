import { DocumentBrowseSchema, documentMime } from "@nextpress/shared/media";
import { writeServerLog } from "@nextpress/shared/server-logging";

import { bad, ok, oops } from "@/lib/api";
import { apiLogContext } from "@/lib/api/request-log-context.server";
import { withAuth } from "@/lib/auth/auth-server";
import { tooManyRequests } from "@/lib/security/rate-limit.server";
import { uploadDocument } from "@/lib/services/document-upload.server";
import { browseMedia } from "@/lib/services/media-library.server";
import {
  MediaBusyError,
  MediaValidationError,
} from "@/lib/services/media.server";
import { parseListFilters } from "@/lib/validation/list-query";

export const GET = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (request, _ctx, { session }) => {
    const query = parseListFilters(
      new URL(request.url).searchParams,
      DocumentBrowseSchema,
    );

    if (!query) {
      return bad("Invalid document filters");
    }

    try {
      return ok(await browseMedia(query, session.user, "document"));
    } catch (error) {
      return oops(error);
    }
  },
);

export const POST = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (request, _ctx, { session }) => {
    try {
      const document = await uploadDocument(request, session.user);
      writeServerLog("api", "media.uploaded", {
        ...apiLogContext(),
        actorId: session.user.id,
        targetId: document.id,
      });

      return ok(document, 201);
    } catch (error) {
      if (error instanceof MediaBusyError) {
        return tooManyRequests(1);
      }

      if (error instanceof MediaValidationError) {
        return bad("Invalid PDF upload");
      }

      return oops(error);
    }
  },
  "create-content",
  documentMime,
);
