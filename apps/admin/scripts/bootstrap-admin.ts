import { prisma } from "@nextpress/db";
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

async function main() {
  const { getAdminBootstrapCredentials } = await import("./admin-bootstrap-policy");
  const { email, password: pass } = getAdminBootstrapCredentials(process.env);

  const adminRole = await ensureRoles();

  await ensureSiteSettings();

  const hash = await hashPassword(pass);

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
  const credential = await prisma.account.findFirst({
    where: {
      userId: admin.id,
      provider: "credential",
    },
    select: { id: true, password: true },
  });

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

  console.log("Administrator bootstrap OK");
}

main()
  .catch(() => {
    console.error("Administrator bootstrap failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
