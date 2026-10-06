import { PrismaPg } from "@prisma/adapter-pg";

import { getDatabaseConnectionString } from "./database-config";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = getDatabaseConnectionString(process.env);

const adapter = new PrismaPg({
  connectionString,
});

const globalForPrisma = globalThis as unknown as {
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
