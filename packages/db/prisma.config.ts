import { defineConfig } from "prisma/config";

import { loadApiEnvironment } from "./src/api-environment";
import { formatDatabaseTarget, resolveDatabase } from "./src/database-config";

loadApiEnvironment();
const { connectionString, target } = resolveDatabase(process.env);
console.info(`Prisma database target: ${formatDatabaseTarget(target)}`);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: connectionString,
  },
});
