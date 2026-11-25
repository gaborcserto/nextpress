import {
  loadApiEnvironment,
  loadMigrationEnvironment,
} from "../src/api-environment";
import { formatDatabaseTarget, resolveDatabase } from "../src/database-config";

const compose = process.argv.includes("--compose");
const migration = process.argv.includes("--migration");

if (migration) {
  loadMigrationEnvironment();
} else {
  loadApiEnvironment(compose ? true : undefined);
}

const { target } = resolveDatabase(process.env);
const role = migration
  ? ` (role ${decodeURIComponent(new URL(process.env.DATABASE_URL ?? "").username)})`
  : "";
console.info(
  `${migration ? "Migration" : "Runtime"} database target: ${formatDatabaseTarget(target)}${role}`,
);

if (
  compose &&
  (!["127.0.0.1", "localhost"].includes(target.host) ||
    target.port !== "5432" ||
    target.database !== "cms" ||
    target.schema !== "public")
) {
  console.error(
    "bootstrap requires the Compose target 127.0.0.1:5432/cms (schema public). For an existing database, start its service separately and run npm run dev.",
  );
  process.exitCode = 1;
}
