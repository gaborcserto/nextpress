import { NavigationMenuMutationSchema } from "@nextpress/shared/api-contracts";
import { writeServerLog } from "@nextpress/shared/server-logging";

import { bad, conflict, internalError, ok } from "@/lib/api/http";
import { apiLogContext } from "@/lib/api/request-log-context.server";
import { withAuth } from "@/lib/auth/auth-server";
import {
  deleteMenu,
  InvalidMenuError,
  listMenus,
  MenuConflictError,
  saveMenu,
} from "@/lib/repos/navigation";

export const GET = withAuth(["ADMIN"], async () => {
  try {
    const response = ok(await listMenus());
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    return internalError(error);
  }
});

export const POST = withAuth(
  ["ADMIN"],
  async (request, _context, { session }) => {
    const parsed = NavigationMenuMutationSchema.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      return bad("Invalid menu request");
    }

    const data = parsed.data;

    try {
      if (data.action === "delete") {
        await deleteMenu(data.id, data.version);
        writeServerLog("api", "navigation.menu.deleted", {
          ...apiLogContext(),
          actorId: session.user.id,
          targetId: data.id,
        });

        return ok({ id: data.id });
      }

      const existing =
        data.action === "update"
          ? { id: data.id, version: data.version }
          : undefined;

      const result = await saveMenu(data.menu, existing);
      writeServerLog(
        "api",
        existing ? "navigation.menu.updated" : "navigation.menu.created",
        {
          ...apiLogContext(),
          actorId: session.user.id,
          targetId: result.id,
        },
      );

      return ok(result, existing ? 200 : 201);
    } catch (error) {
      if (error instanceof InvalidMenuError) {
        return bad(error.message);
      }

      if (error instanceof MenuConflictError) {
        return conflict(error.message);
      }

      return internalError(error);
    }
  },
  "settings",
);
