export const runtime = "nodejs";

import { prisma } from "@nextpress/db/src/client";

import { ok, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";

export const GET = withAuth(["ADMIN"], async () => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { name: true } },
      },
    });

    return ok(
      users.map((u) => ({
        ...u,
        roleName: u.role?.name ?? null,
      }))
    );
  } catch {
    console.error("GET /api/admin/users failed");
    return oops();
  }
});
