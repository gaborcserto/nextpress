import { loadApiEnvironment } from "../src/api-environment";
import { formatDatabaseTarget, resolveDatabase } from "../src/database-config";

const compose = process.argv.includes("--compose");
loadApiEnvironment(compose ? true : undefined);
const { target } = resolveDatabase(process.env);
console.info(`Database target: ${formatDatabaseTarget(target)}`);

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
