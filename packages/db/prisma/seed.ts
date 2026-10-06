// The same public hashing utility used by Better Auth's default crypto contract.
import { hashPassword } from "@better-auth/utils/password";
import {PrismaPg} from "@prisma/adapter-pg";

import {PageLayout, PageType, PrismaClient, PublishStatus} from "../generated/prisma/client";
import { getDatabaseConnectionString } from "../src/database-config";
import { getAdminSeedCredentials } from "../src/seed-policy";

const adapter = new PrismaPg({
  connectionString: getDatabaseConnectionString(process.env),
});

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma || new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

async function ensureRoles() {
  const roles = ["ADMIN", "EDITOR", "AUTHOR", "SUBSCRIBER"] as const;

  const out = {} as Record<(typeof roles)[number], { id: string; name: string }>;

  for (const name of roles) {
    out[name] = await prisma.role.upsert({
      where: {name},
      create: {name},
      update: {},
      select: {id: true, name: true},
    });
  }

  return out;
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
  const { email, password: pass } = getAdminSeedCredentials(process.env);

  const roles = await ensureRoles();
  const adminRole = roles.ADMIN;

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

  // Seed a simple test page
  await prisma.page.upsert({
    where: { slug: "test" },
    create: {
      type: PageType.PAGE,
      layout: PageLayout.STANDARD,
      status: PublishStatus.DRAFT,
      slug: "test",
      title: "Test",
      excerpt: "",
      content: "Test text",
      authorId: admin.id,
      inHeaderMenu: false,
      inFooterMenu: false,
    },
    update: {},
  });

  console.log("Seed OK");
}

main()
  .catch(() => {
    console.error("Seeding failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
