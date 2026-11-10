export const runtime = "nodejs";

import { ok, oops, bad, notfound, conflict } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import {
  administerUser,
  LastAdministratorError,
} from "@/lib/auth/user-administration.server";

export const DELETE = withAuth(
  ["ADMIN"],
  async (_req, ctx, auth) => {
    if (!ctx.params.id || ctx.params.id.length > 64)
      return bad("Invalid user ID");
    try {
      await administerUser(
        { id: auth.session.user.id, role: auth.roleName },
        ctx.params.id,
        null,
      );
      console.info(
        JSON.stringify({
          event: "user.deleted",
          actorId: auth.session.user.id,
          targetId: ctx.params.id,
        }),
      );

      return ok({ ok: true });
    } catch (e) {
      if (e instanceof LastAdministratorError)
        return conflict("At least one administrator is required");
      if (
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        e.code === "P2025"
      )
        return notfound("User not found");
      console.error("DELETE /api/admin/users/:id failed");

      return oops();
    }
  },
  "users",
);
