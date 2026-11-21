import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tsImport } from "tsx/esm/api";

const {
  disposableDockerContext,
  removeDisposableNetwork,
  verifyLocalDocker,
  verifyProvisioningCleanup,
  watchDisposableInterrupt,
} = await tsImport(
  "../apps/api/src/lib/testing/docker-database.ts",
  import.meta.url,
);
verifyLocalDocker();
const dockerContext = disposableDockerContext().name;

const token = randomUUID();
const name = `nextpress-e2e-${token}`;
const networkName = `${name}-db`;
const imageReference = "postgres:18";
const port = 55441;
const environment = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL:
    "postgresql://postgres:disposable-e2e@localhost:55441/nextpress_e2e",
  BETTER_AUTH_SECRET: "disposable-e2e-auth-secret-at-least-32-characters",
  ADMIN_EMAIL: "admin@example.invalid",
  ADMIN_PASSWORD: "Disposable browser passphrase 2026",
  MEDIA_STORAGE_ROOT: path.resolve(".notes", "e2e-media", name),
};

function docker(...args) {
  return execFileSync("docker", ["--context", dockerContext, ...args], {
    encoding: "utf8",
    timeout: 30000,
  }).trim();
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    env: environment,
    stdio: "inherit",
    timeout: 600_000,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status})`);
  }
}

// Install the browser revision required by the current Playwright package.
run(process.execPath, [
  "node_modules/@playwright/test/cli.js",
  "install",
  "chromium",
]);

let container;
let network;
let image;
const interruption = watchDisposableInterrupt();

function verifyOwnedDatabase() {
  verifyLocalDocker();
  verifyProvisioningCleanup(
    { run: token, container, network, networkName, image, port },
    JSON.parse(docker("container", "inspect", container)),
    JSON.parse(docker("network", "inspect", network)),
  );
}

async function runTestStep(command, args, options) {
  await interruption.checkpoint();
  run(command, args, options);
  await interruption.checkpoint();
}

try {
  network = docker(
    "network",
    "create",
    "--driver",
    "bridge",
    "--label",
    `nextpress.disposable=${token}`,
    networkName,
  );
  container = docker(
    "create",
    "--name",
    name,
    "--label",
    `nextpress.disposable=${token}`,
    "--network",
    networkName,
    "--publish",
    `127.0.0.1:${port}:5432`,
    "--tmpfs",
    "/var/lib/postgresql:rw",
    "--env",
    "POSTGRES_PASSWORD=disposable-e2e",
    "--env",
    "POSTGRES_DB=nextpress_e2e",
    imageReference,
  );
  image = docker("image", "inspect", imageReference, "--format", "{{.Id}}");
  verifyOwnedDatabase();
  await interruption.checkpoint();
  docker("start", container);
  verifyOwnedDatabase();
  let databaseReady = false;

  for (let attempt = 0; attempt < 30; attempt++) {
    const ready = spawnSync(
      "docker",
      [
        "--context",
        dockerContext,
        "exec",
        container,
        "pg_isready",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
      ],
      { stdio: "ignore", timeout: 30000 },
    );

    if (ready.status === 0) {
      databaseReady = true;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    await interruption.checkpoint();
  }

  if (!databaseReady) {
    throw new Error("Disposable E2E PostgreSQL never became ready");
  }

  // Upgrade populated pre-composition data, rather than testing only empty databases.
  const legacyRoot = path.resolve(".notes", "e2e-upgrades", name);
  const legacyMigrations = path.join(legacyRoot, "migrations");
  mkdirSync(legacyMigrations, { recursive: true });
  const migrationRoot = path.resolve("packages/db/prisma/migrations");

  for (const entry of readdirSync(migrationRoot, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      entry.name < "20261110220000_page_working_revisions"
    ) {
      cpSync(
        path.join(migrationRoot, entry.name),
        path.join(legacyMigrations, entry.name),
        { recursive: true },
      );
    }
  }

  cpSync(
    path.join(migrationRoot, "migration_lock.toml"),
    path.join(legacyMigrations, "migration_lock.toml"),
  );
  const config = path.join(legacyRoot, "prisma.config.ts");
  writeFileSync(
    config,
    `import { defineConfig, env } from "prisma/config";
export default defineConfig({schema: ${JSON.stringify(path.resolve("packages/db/prisma/schema.prisma"))}, migrations: {path: ${JSON.stringify(legacyMigrations)}}, datasource: {url: env("DATABASE_URL")}});
`,
  );
  await runTestStep(process.execPath, [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--config",
    config,
  ]);
  const evidence = path.join(legacyRoot, "content-fingerprint.json");
  await runTestStep(process.execPath, [
    "node_modules/tsx/dist/cli.mjs",
    "e2e/legacy-content-fixtures.ts",
    "before",
    evidence,
  ]);
  run(
    process.execPath,
    ["../../node_modules/prisma/build/index.js", "migrate", "deploy"],
    { cwd: "packages/db" },
  );
  await runTestStep(process.execPath, [
    "node_modules/tsx/dist/cli.mjs",
    "e2e/legacy-content-fixtures.ts",
    "after",
    evidence,
  ]);

  // Guarded families own their independent clusters, roles, identity and cleanup.
  for (const family of ["content", "security"]) {
    await runTestStep(
      process.execPath,
      [
        path.resolve("node_modules/tsx/dist/cli.mjs"),
        "scripts/b04-postgres.ts",
        family,
      ],
      { cwd: "apps/api", env: process.env },
    );
  }

  await runTestStep(process.execPath, [
    "node_modules/tsx/dist/cli.mjs",
    "apps/api/scripts/bootstrap-admin.ts",
  ]);

  if (process.env.NEXTPRESS_E2E_WEB_PRODUCTION === "1") {
    const artifact = path.resolve(".notes", "e2e-builds", name);
    await runTestStep(process.execPath, [
      "scripts/package-app.mjs",
      "web",
      artifact,
    ]);
    await runTestStep(process.execPath, [
      "scripts/scan-artifacts.mjs",
      artifact,
    ]);
    environment.NEXTPRESS_E2E_WEB_ARTIFACT = artifact;
  }

  await runTestStep(process.execPath, [
    "node_modules/@playwright/test/cli.js",
    "test",
    ...process.argv.slice(2),
  ]);
  await runTestStep(process.execPath, ["scripts/e2e-outage.mjs"]);
} finally {
  try {
    verifyLocalDocker();

    if (container) {
      verifyOwnedDatabase();
      docker("container", "rm", "--force", container);
    }

    if (network) {
      removeDisposableNetwork(network, token);
    }

    if (container || network) {
      console.log(`Removed disposable E2E database resources for ${name}`);
    }
  } catch {
    console.error(
      `E2E cleanup failed for ${name} (${container ?? "no container"}, ${network ?? "no network"})`,
    );
    process.exitCode = 1;
  } finally {
    interruption.close();
  }
}
