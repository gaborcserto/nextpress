export const runtime = "nodejs";

import { prisma } from "@nextpress/db/src/client";

import { ok, bad, oops, notfound } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import { isRole } from "@/lib/auth/roles";

export const PATCH = withAuth(["ADMIN"], async (_req, ctx) => {
  if (!ctx.params.id || ctx.params.id.length > 64) return bad("Invalid user ID");
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
  if (!isRole(role)) return bad("Invalid role");

  try {
    const updated = await prisma.user.update({
      where: { id: ctx.params.id },
      data: { role: { connect: { name: role } } },
      select: { id: true, role: { select: { name: true } } },
    });

    return ok({ id: updated.id, roleName: updated.role?.name ?? null });
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2025") return notfound("User not found");
    console.error("PATCH /api/admin/users/:id/role failed");
    return oops();
  }
});
