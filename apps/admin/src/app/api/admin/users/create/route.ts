export const runtime = "nodejs";

import bcrypt from "bcryptjs";
import { prisma } from "@nextpress/db/src/client";

import { ok, bad, conflict, oops } from "@/lib/api";
import { withAuth, ROLES, type RoleName } from "@/lib/auth/auth-server";

type Body = {
  email: string;
  name?: string | null;
  role: RoleName;
  password?: string;
};

function isRole(x: unknown): x is RoleName {
  return typeof x === "string" && (ROLES as readonly string[]).includes(x);
}

export const POST = withAuth(["ADMIN"], async (req) => {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("Invalid JSON");
  }

  if (!body.email) return bad("Email is required");
  if (!isRole(body.role)) return bad("Invalid role");

  try {
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing) return conflict("Email already exists");

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name ?? null,
        role: { connect: { name: body.role } },
        accounts: body.password
          ? {
            create: {
              provider: "credentials",
              providerAccountId: body.email,
              password: await bcrypt.hash(body.password, 10),
            },
          }
          : undefined,
      },
      select: { id: true, email: true, name: true, role: { select: { name: true } } },
    });

    return ok({ ...user, roleName: user.role?.name ?? null }, 201);
  } catch (e) {
    console.error("POST /api/admin/users/create error:", e);
    return oops();
  }
});
