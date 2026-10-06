export const runtime = "nodejs";

import { prisma } from "@nextpress/db/src/client";
import { emailSchema, passwordSchema } from "@nextpress/shared/auth-policy";
import { randomUUID } from "node:crypto";

import { ok, bad, conflict, oops } from "@/lib/api";
import { getAuth, withAuth } from "@/lib/auth/auth-server";
import { isRole, type RoleName } from "@/lib/auth/roles";
import { getDefaultUserRole } from "@/lib/settings/site-settings";

type Body = {
  email: string;
  name?: string | null;
  role: RoleName;
  password?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const POST = withAuth(["ADMIN"], async (req) => {
  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return bad("Invalid JSON");
  }

  if (!isRecord(input) || typeof input.email !== "string") {
    return bad("Email is required");
  }
  if (input.name !== undefined && input.name !== null && typeof input.name !== "string") {
    return bad("Invalid name");
  }
  if (input.password !== undefined && typeof input.password !== "string") {
    return bad("Invalid password");
  }
  if (input.role !== undefined && !isRole(input.role)) return bad("Invalid role");

  const parsedEmail = emailSchema.safeParse(input.email);
  if (!parsedEmail.success) return bad("Invalid email");
  const email = parsedEmail.data;
  if (typeof input.name === "string" && input.name.length > 200) {
    return bad("Name must not exceed 200 characters");
  }
  if (input.password !== undefined) {
    const parsedPassword = passwordSchema.safeParse(input.password);
    if (!parsedPassword.success) return bad(parsedPassword.error.issues[0]?.message ?? "Invalid password");
  }

  const body: Body = {
    email,
    name: typeof input.name === "string" ? input.name.trim() || null : null,
    password: typeof input.password === "string" ? input.password : undefined,
    role: isRole(input.role) ? input.role : await getDefaultUserRole(),
  };

  try {
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing) return conflict("Email already exists");

    const id = randomUUID();
    let password: string | undefined;
    if (body.password !== undefined) {
      const auth = await getAuth();
      const context = await auth.$context;
      password = await context.password.hash(body.password);
    }
    // Atomic provisioning using Better Auth's mapped account contract:
    // providerId=credential, accountId=user.id, and the configured hash function.
    const user = await prisma.user.create({
      data: {
        id,
        email: body.email,
        name: body.name ?? null,
        role: { connect: { name: body.role } },
        accounts: password
          ? {
              create: {
                provider: "credential",
                providerAccountId: id,
                password,
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
