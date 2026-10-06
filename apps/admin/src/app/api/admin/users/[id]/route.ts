export const runtime = "nodejs";

import { prisma } from "@nextpress/db/src/client";

import { ok, oops, bad, notfound } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";

export const DELETE = withAuth(["ADMIN"], async (_req, ctx) => {
  if (!ctx.params.id || ctx.params.id.length > 64) return bad("Invalid user ID");
  try {
    await prisma.user.delete({ where: { id: ctx.params.id } });
    return ok({ ok: true });
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2025") return notfound("User not found");
    console.error("DELETE /api/admin/users/:id failed");
    return oops();
  }
});
