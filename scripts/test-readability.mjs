import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const environment = { ...process.env };
delete environment.NODE_TEST_CONTEXT;
const result = spawnSync(
  process.execPath,
  ["--test", "--test-reporter=spec", "scripts/readability.test.mjs"],
  { cwd: root, env: environment, stdio: "inherit" },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
