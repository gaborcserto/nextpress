import {PageLayout, PageType, PrismaClient, PublishStatus} from "../generated/prisma/client";
import {PrismaPg} from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma || new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

async function ensureRoles() {
  const roles = ["ADMIN", "EDITOR", "AUTHOR", "SUBSCRIBER"] as const;

  const out: Record<(typeof roles)[number], { id: string; name: string }> =
    {} as any;

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

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const pass = process.env.ADMIN_PASSWORD || "admin123";

  // Ensure ADMIN role exists
  const roles = await ensureRoles();
  const adminRole = roles.ADMIN;

  const hash = await bcrypt.hash(pass, Number(process.env.BCRYPT_COST ?? 12));

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
      providerAccountId: email,
    },
    select: { id: true, password: true },
  });

  if (!credential) {
    await prisma.account.create({
      data: {
        userId: admin.id,
        type: "credentials",
        provider: "credential",
        providerAccountId: email,
        password: hash,
      },
    });
  } else if (!credential.password) {
    await prisma.account.update({
      where: { id: credential.id },
      data: { password: hash },
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
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
