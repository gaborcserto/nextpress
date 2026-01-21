export const runtime = "nodejs";

import { prisma } from "@nextpress/db/src/client";

import { ok, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";

export const DELETE = withAuth(["ADMIN"], async (_req, ctx) => {
  try {
    await prisma.user.delete({ where: { id: ctx.params.id } });
    return ok({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/users/:id error:", e);
    return oops();
  }
});
