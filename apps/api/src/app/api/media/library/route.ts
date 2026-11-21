import { MediaBrowseSchema } from "@nextpress/shared/media";

import { bad, ok, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import { browseMedia } from "@/lib/services/media-library.server";
import { parseListFilters } from "@/lib/validation/list-query";

export const GET = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (request, _ctx, { session }) => {
    const query = parseListFilters(
      new URL(request.url).searchParams,
      MediaBrowseSchema,
    );

    if (!query) {
      return bad("Invalid media filters");
    }

    try {
      return ok(await browseMedia(query, session.user));
    } catch (error) {
      return oops(error);
    }
  },
);
