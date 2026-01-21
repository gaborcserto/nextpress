export const runtime = "nodejs";

import { prisma } from "@nextpress/db/src/client";

import { ok, bad, oops } from "@/lib/api";
import { withAuth, ROLES, type RoleName } from "@/lib/auth/auth-server";

type Body = { role: RoleName };

function isRole(x: unknown): x is RoleName {
  return typeof x === "string" && (ROLES as readonly string[]).includes(x);
}

export const PATCH = withAuth(["ADMIN"], async (_req, ctx) => {
  let body: unknown;
  try {
    body = await _req.json();
  } catch {
    return bad("Invalid JSON");
  }

  const role = (body as Partial<Body>)?.role;
  if (!isRole(role)) return bad("Invalid role");

  try {
    const updated = await prisma.user.update({
      where: { id: ctx.params.id },
      data: { role: { connect: { name: role } } },
      select: { id: true, role: { select: { name: true } } },
    });

    return ok({ id: updated.id, roleName: updated.role?.name ?? null });
  } catch (e) {
    console.error("PATCH /api/admin/users/:id/role error:", e);
    return oops();
  }
});
