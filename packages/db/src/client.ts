import { PrismaPg } from "@prisma/adapter-pg";

import { resolveDatabase } from "./database-config";
import { PrismaClient } from "../generated/prisma/client";

const { connectionString, target } = resolveDatabase(process.env);
const databaseUrl = new URL(connectionString);
const startupOptions = databaseUrl.searchParams.get("options");

// TIMESTAMP(3) defaults cast the database clock to the session timezone.
databaseUrl.searchParams.set(
  "options",
  [startupOptions, "-c timezone=UTC"].filter(Boolean).join(" "),
);
const adapter = new PrismaPg(
  { connectionString: databaseUrl.href },
  { schema: target.schema },
);

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
