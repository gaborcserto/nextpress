import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const name = `nextpress-e2e-${randomUUID()}`;
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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    env: environment,
    stdio: "inherit",
    timeout: 600_000,
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed (${result.status})`);
}

let started = false;

try {
  run("docker", [
    "run",
    "--detach",
    "--rm",
    "--name",
    name,
    "--publish",
    "127.0.0.1:55441:5432",
    "--env",
    "POSTGRES_PASSWORD=disposable-e2e",
    "--env",
    "POSTGRES_DB=nextpress_e2e",
    "postgres:18",
  ]);
  started = true;
  for (let attempt = 0; attempt < 30; attempt++) {
    const ready = spawnSync(
      "docker",
      ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
      { stdio: "ignore" },
    );

    if (ready.status === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
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
  run(process.execPath, [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--config",
    config,
  ]);
  const evidence = path.join(legacyRoot, "content-fingerprint.json");
  run(process.execPath, [
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
  run(process.execPath, [
    "node_modules/tsx/dist/cli.mjs",
    "e2e/legacy-content-fixtures.ts",
    "after",
    evidence,
  ]);
  for (const database of [
    "nextpress_phase1_verify_e2e",
    "nextpress_security_verify_e2e",
  ]) {
    run("docker", [
      "exec",
      name,
      "psql",
      "-U",
      "postgres",
      "-d",
      "nextpress_e2e",
      "-c",
      `CREATE DATABASE ${database}`,
    ]);
    const isolated = {
      ...environment,
      DATABASE_URL: `postgresql://postgres:disposable-e2e@localhost:55441/${database}`,
    };
    run(
      process.execPath,
      ["../../node_modules/prisma/build/index.js", "migrate", "deploy"],
      { cwd: "packages/db", env: isolated },
    );
    if (database.startsWith("nextpress_security")) {
      run("docker", [
        "exec",
        name,
        "psql",
        "-U",
        "postgres",
        "-d",
        database,
        "-c",
        `INSERT INTO "Role" (id,name) VALUES ('admin','ADMIN'),('editor','EDITOR'),('author','AUTHOR'),('subscriber','SUBSCRIBER')`,
      ]);
      run(
        process.execPath,
        [
          path.resolve("node_modules/vitest/vitest.mjs"),
          "run",
          "src/lib/auth/live-postgres.integration.test.ts",
          "--maxWorkers=1",
        ],
        {
          cwd: "apps/api",
          env: {
            ...isolated,
            NEXTPRESS_SECURITY_TEST_DATABASE_URL: isolated.DATABASE_URL,
          },
        },
      );
    } else {
      run(
        process.execPath,
        [
          path.resolve("node_modules/vitest/vitest.mjs"),
          "run",
          "src/lib/repos/content-transaction.integration.test.ts",
          "src/lib/auth/user-administration.integration.test.ts",
          "--maxWorkers=1",
        ],
        {
          cwd: "apps/api",
          env: {
            ...isolated,
            NEXTPRESS_CONTENT_TEST_DATABASE_URL: isolated.DATABASE_URL,
          },
        },
      );
    }
  }
  run(process.execPath, [
    "node_modules/tsx/dist/cli.mjs",
    "apps/api/scripts/bootstrap-admin.ts",
  ]);
  if (process.env.NEXTPRESS_E2E_WEB_PRODUCTION === "1") {
    const artifact = path.resolve(".notes", "e2e-builds", name);
    run(process.execPath, ["scripts/package-app.mjs", "web", artifact]);
    run(process.execPath, ["scripts/scan-artifacts.mjs", artifact]);
    environment.NEXTPRESS_E2E_WEB_ARTIFACT = artifact;
  }
  run(process.execPath, [
    "node_modules/@playwright/test/cli.js",
    "test",
    ...process.argv.slice(2),
  ]);
  run(process.execPath, ["scripts/e2e-outage.mjs"]);
} finally {
  if (started) run("docker", ["stop", name]);
}
