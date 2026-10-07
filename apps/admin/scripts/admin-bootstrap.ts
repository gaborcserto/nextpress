import { prisma } from "@nextpress/db";
import { emailSchema } from "@nextpress/shared/auth-policy";
import { hashPassword } from "better-auth/crypto";

async function ensureRoles() {
  const roles = ["ADMIN", "EDITOR", "AUTHOR", "SUBSCRIBER"] as const;

  for (const name of roles) {
    await prisma.role.upsert({
      where: {name},
      create: {name},
      update: {},
      select: {id: true, name: true},
    });
  }

  return prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" }, select: { id: true } });
}

async function ensureSiteSettings() {
  const providers = [
    "google",
    "github",
    "apple",
    "facebook",
    "discord",
    "twitter",
  ];

  const settings = await prisma.siteSettings.upsert({
    where: {id: "default"},
    create: {
      id: "default",
      siteName: "NextPress",
      siteDescription: "NextPress admin",
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || null,
      defaultUserRole: "SUBSCRIBER",
    },
    update: {},
    select: {id: true},
  });

  for (const provider of providers) {
    await prisma.oAuthProvider.upsert({
      where: {provider},
      update: {},
      create: {
        provider,
        settingsId: settings.id,
      },
    });
  }
}

export async function bootstrapAdmin(environment: NodeJS.ProcessEnv) {
  const { getAdminBootstrapCredentials } = await import("./admin-bootstrap-policy");
  const email = emailSchema.parse(environment.ADMIN_EMAIL);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const credential = existing ? await prisma.account.findFirst({
    where: { userId: existing.id, provider: "credential" },
    select: { id: true, password: true },
  }) : null;
  const { password: pass } = getAdminBootstrapCredentials(environment, !!credential?.password);

  const adminRole = await ensureRoles();

  await ensureSiteSettings();

  const hash = pass === null ? null : await hashPassword(pass);

  // Ensure admin user exists
  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Admin",
      role: { connect: { id: adminRole.id } },
      emailVerified: true,
    },
    update: {
      role: { connect: { id: adminRole.id } },
      emailVerified: true,
    },
    select: { id: true, email: true },
  });

  // Ensure credential account exists for admin
  if (!credential) {
    await prisma.account.create({
      data: {
        userId: admin.id,
        provider: "credential",
        providerAccountId: admin.id,
        password: hash,
      },
    });
  } else {
    await prisma.account.update({
      where: { id: credential.id },
      // Correct the legacy email-keyed account without replacing an existing hash.
      data: { providerAccountId: admin.id, ...(!credential.password ? { password: hash } : {}) },
    });
  }

  return { preservedPassword: !!credential?.password };
}
