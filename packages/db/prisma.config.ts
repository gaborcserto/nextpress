import { defineConfig } from "prisma/config";

import { loadMigrationEnvironment } from "./src/api-environment";
import { formatDatabaseTarget, resolveDatabase } from "./src/database-config";

loadMigrationEnvironment();
const { connectionString, target } = resolveDatabase(process.env);
const migrationRole = decodeURIComponent(new URL(connectionString).username);
console.info(
  `Prisma migration target: ${formatDatabaseTarget(target)} (role ${migrationRole})`,
);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: connectionString,
  },
});
