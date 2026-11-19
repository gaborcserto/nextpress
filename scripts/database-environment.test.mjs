import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempDisposableSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";

const root = dirname(import.meta.dirname);
const editorial =
  "postgresql://fixture:fixture_secret@127.0.0.1:55434/nextpress_dev_editorial";
const compose = "postgresql://fixture:fixture_secret@127.0.0.1:5432/cms";
const isolated =
  "postgresql://fixture:fixture_secret@127.0.0.1:54123/nextpress_dev_verify_fixture";

function fixture(t) {
  const temporary = mkdtempDisposableSync(
    join(root, "node_modules", ".nextpress-db-config-"),
  );
  t.after(() => temporary.remove());

  for (const file of [
    "packages/db/prisma.config.ts",
    "packages/db/prisma/target.ts",
    "packages/db/src/api-environment.ts",
    "packages/db/src/database-config.ts",
  ]) {
    const destination = join(temporary.path, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(root, file), destination);
  }

  const api = join(temporary.path, "apps/api");
  const db = join(temporary.path, "packages/db");
  mkdirSync(api, { recursive: true });
  writeFileSync(join(db, ".env"), `DATABASE_URL=${compose}\n`);

  return { api, db };
}

function runTsx(cwd, args, overrides = {}) {
  const env = { ...process.env, NODE_ENV: "development", ...overrides };

  if (overrides.DATABASE_URL === undefined) {
    delete env.DATABASE_URL;
  }

  delete env.__NEXT_PROCESSED_ENV;

  return spawnSync(
    process.execPath,
    [join(root, "node_modules/tsx/dist/cli.mjs"), ...args],
    {
      cwd,
      env,
      encoding: "utf8",
    },
  );
}

function prismaConfig(db, overrides) {
  return runTsx(
    db,
    [
      "--eval",
      `
        const config = require("./prisma.config.ts").default;
        const { resolveDatabase } = require("./src/database-config.ts");
        if (config.datasource.url !== resolveDatabase(process.env).connectionString) {
          throw new Error("Prisma datasource differs from the resolved API URL");
        }
      `,
    ],
    overrides,
  );
}

test("Prisma config follows the API development dotenv order and expansion", (t) => {
  const { api, db } = fixture(t);
  writeFileSync(join(api, ".env"), `DATABASE_URL=${compose}\n`);
  writeFileSync(
    join(api, ".env.development.local"),
    `EDITORIAL_NAME=nextpress_dev_editorial\nDATABASE_URL=${editorial.replace("nextpress_dev_editorial", "$EDITORIAL_NAME")}\n`,
  );

  const next = runTsx(api, [
    "--eval",
    `
    require("@next/env").loadEnvConfig(process.cwd(), true);
    const { target } = require("../../packages/db/src/database-config.ts").resolveDatabase(process.env);
    console.log(target.database);
  `,
  ]);
  assert.equal(next.status, 0, next.stderr);
  assert.equal(next.stdout.trim(), "nextpress_dev_editorial");

  const prisma = prismaConfig(db);
  assert.equal(prisma.status, 0, prisma.stderr);
  assert.equal(
    prisma.stdout.trim(),
    'Prisma database target: 127.0.0.1:55434/nextpress_dev_editorial (schema "public")',
  );
});

test("isolated and production process URLs take precedence over local files", (t) => {
  const { api, db } = fixture(t);
  writeFileSync(join(api, ".env"), `DATABASE_URL=${editorial}\n`);

  for (const NODE_ENV of ["development", "production"]) {
    const result = prismaConfig(db, { DATABASE_URL: isolated, NODE_ENV });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /:54123\/nextpress_dev_verify_fixture/);
    assert.doesNotMatch(result.stdout + result.stderr, /fixture_secret/);
  }
});

test("an explicit production phase selects the API production file", (t) => {
  const { api, db } = fixture(t);
  writeFileSync(
    join(api, ".env.development.local"),
    `DATABASE_URL=${editorial}\n`,
  );
  writeFileSync(
    join(api, ".env.production.local"),
    `DATABASE_URL=${isolated}\n`,
  );

  const result = prismaConfig(db, { NODE_ENV: "production" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /:54123\/nextpress_dev_verify_fixture/);
});

test("missing and invalid Prisma URLs fail without exposing secrets or using packages/db/.env", (t) => {
  const { db } = fixture(t);
  const missing = prismaConfig(db);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /DATABASE_URL is not set/);

  const invalid = prismaConfig(db, {
    DATABASE_URL: "https://fixture:fixture_secret@localhost/cms",
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /DATABASE_URL must be a valid PostgreSQL URL/);
  assert.doesNotMatch(invalid.stdout + invalid.stderr, /fixture_secret/);
});

test("Compose bootstrap preflight accepts cms and refuses the editorial target", (t) => {
  const { api, db } = fixture(t);
  writeFileSync(join(api, ".env"), `DATABASE_URL=${editorial}\n`);
  const args = ["prisma/target.ts", "--compose"];
  const editorialTarget = runTsx(db, args);
  assert.equal(editorialTarget.status, 1);
  assert.match(editorialTarget.stderr, /bootstrap requires the Compose target/);

  const composeTarget = runTsx(db, args, { DATABASE_URL: compose });
  assert.equal(composeTarget.status, 0, composeTarget.stderr);
  assert.match(composeTarget.stdout, /:5432\/cms/);
});

test("Turbo forwards the database override to the API and uncached Prisma tasks", () => {
  const result = spawnSync(
    process.execPath,
    [
      join(root, "node_modules/turbo/bin/turbo"),
      "run",
      "dev",
      "build",
      "validate",
      "prisma:generate",
      "prisma:deploy",
      "prisma:migrate",
      "seed",
      "--dry=json",
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: isolated },
    },
  );
  assert.equal(result.status, 0, result.stderr);

  const tasks = new Map(
    JSON.parse(result.stdout).tasks.map((task) => [task.taskId, task]),
  );

  for (const id of [
    "api#dev",
    "api#build",
    "@nextpress/db#validate",
    "@nextpress/db#prisma:generate",
    "@nextpress/db#prisma:deploy",
    "@nextpress/db#prisma:migrate",
    "@nextpress/db#seed",
  ]) {
    const task = tasks.get(id);
    assert.ok(
      task.environmentVariables.specified.env.includes("DATABASE_URL"),
      id,
    );
    assert.ok(
      task.environmentVariables.configured.some((entry) =>
        entry.startsWith("DATABASE_URL="),
      ),
      id,
    );

    if (id.startsWith("@nextpress/db#")) {
      assert.equal(task.resolvedTaskDefinition.cache, false, id);
      assert.ok(
        task.environmentVariables.specified.env.includes("NODE_ENV"),
        id,
      );
    }
  }

  assert.ok(
    tasks
      .get("@nextpress/db#seed")
      .environmentVariables.specified.env.includes(
        "ALLOW_DEVELOPMENT_CONTENT_SEED",
      ),
  );

  for (const id of ["admin#dev", "admin#build", "web#dev", "web#build"]) {
    assert.ok(
      !tasks
        .get(id)
        .environmentVariables.specified.env.includes("DATABASE_URL"),
      id,
    );
  }
});
