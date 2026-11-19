export const runtime = "nodejs";

import { writeServerLog } from "@nextpress/shared/server-logging";

import { ok, bad, oops, notfound, conflict } from "@/lib/api";
import { apiLogContext } from "@/lib/api/request-log-context.server";
import { withAuth } from "@/lib/auth/auth-server";
import { isRole } from "@/lib/auth/roles";
import {
  administerUser,
  LastAdministratorError,
} from "@/lib/auth/user-administration.server";

export const PATCH = withAuth(
  ["ADMIN"],
  async (_req, ctx, auth) => {
    if (!ctx.params.id || ctx.params.id.length > 64) {
      return bad("Invalid user ID");
    }

    let body: unknown;

    try {
      body = await _req.json();
    } catch {
      return bad("Invalid JSON");
    }

    const role =
      typeof body === "object" && body !== null && "role" in body
        ? body.role
        : undefined;

    if (!isRole(role)) {
      return bad("Invalid role");
    }

    try {
      const updated = await administerUser(
        { id: auth.session.user.id, role: auth.roleName },
        ctx.params.id,
        role,
      );

      if (!updated) {
        return oops();
      }

      writeServerLog("api", "user.role.changed", {
        ...apiLogContext(),
        actorId: auth.session.user.id,
        targetId: updated.id,
        role,
      });

      return ok({ id: updated.id, roleName: updated.role?.name ?? null });
    } catch (e) {
      if (e instanceof LastAdministratorError) {
        return conflict("At least one administrator is required");
      }

      if (
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        e.code === "P2025"
      ) {
        return notfound("User not found");
      }

      return oops(e);
    }
  },
  "users",
);
