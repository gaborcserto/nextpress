import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { prisma } from "@nextpress/db/src/client";

const root = resolve(import.meta.dirname, "../../..");
const migrationName = "20261116120000_editorial_persistence_foundation";

// Called only after the harness verifies cluster identity, role, database and nonce.
export async function verifyEditorialMigration(db: typeof prisma) {
  const source = resolve(root, "packages/db/prisma/migrations");
  const cache = resolve(root, "apps/api/node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  const temporary = mkdtempSync(resolve(cache, "editorial-migrations-"));
  const migrations = resolve(temporary, "migrations");
  mkdirSync(migrations);
  const names = readdirSync(source)
    .filter((name) => name < migrationName && name !== "migration_lock.toml")
    .sort();
  assert.equal(names.length, 11);
  cpSync(
    resolve(source, "migration_lock.toml"),
    resolve(migrations, "migration_lock.toml"),
  );

  for (const name of names) {
    cpSync(resolve(source, name), resolve(migrations, name), {
      recursive: true,
    });
  }

  const config = resolve(temporary, "prisma.config.ts");
  writeFileSync(
    config,
    `import { defineConfig } from "prisma/config";
export default defineConfig({ schema: ${JSON.stringify(resolve(root, "packages/db/prisma/schema.prisma"))}, migrations: { path: ${JSON.stringify(migrations)} }, datasource: { url: process.env.DATABASE_URL } });`,
  );

  function cli(args: string[], expectedSuccess = true) {
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, "node_modules/prisma/build/index.js"),
        ...args,
        "--config",
        config,
      ],
      { encoding: "utf8", cwd: root },
    );
    assert.equal(
      result.status === 0,
      expectedSuccess,
      `Prisma ${args.join(" ")} outcome (credentials suppressed)`,
    );
  }

  cli(["migrate", "deploy"]);
  const history = await db.$queryRaw<
    { migration_name: string; checksum: string; finished_at: Date }[]
  >`SELECT migration_name,checksum,finished_at FROM "_prisma_migrations" ORDER BY migration_name`;
  assert.equal(history.length, 11);

  for (const row of history) {
    assert.equal(
      row.checksum,
      createHash("sha256")
        .update(
          readFileSync(resolve(source, row.migration_name, "migration.sql")),
        )
        .digest("hex"),
    );
  }

  const columns = () =>
    db.$queryRaw<
      {
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        datetime_precision: number | null;
      }[]
    >`SELECT table_name,column_name,data_type,is_nullable,column_default,datetime_precision FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`;
  const beforeColumns = await columns();

  const fixture = await db.page.create({
    data: {
      id: "b043-preservation",
      type: "POST",
      slug: "b043-preservation",
      title: "Synthetic legacy projection",
      content: "legacy",
      status: "PUBLISHED",
      publishedAt: new Date("2020-01-01T00:00:00Z"),
    },
  });

  const sql = readFileSync(
    resolve(source, migrationName, "migration.sql"),
    "utf8",
  );
  assert.equal((sql.match(/CREATE TABLE/g) ?? []).length, 14);
  assert(
    !/\b(?:DROP|DELETE|UPDATE|TRUNCATE)\b(?!:|\s+(?:NO ACTION|RESTRICT|SET NULL))/i.test(
      sql.replace(/ON DELETE (?:RESTRICT|SET NULL)/g, ""),
    ),
  );
  cpSync(resolve(source, migrationName), resolve(migrations, migrationName), {
    recursive: true,
  });
  cli(["migrate", "deploy"]);
  cli(["migrate", "deploy"]);
  const after = await db.$queryRaw<
    typeof history
  >`SELECT migration_name,checksum,finished_at FROM "_prisma_migrations" ORDER BY migration_name`;
  assert.deepEqual(after.slice(0, 11), history);
  assert.equal(after.length, 12);
  assert.equal(
    after[11]?.checksum,
    createHash("sha256")
      .update(readFileSync(resolve(source, migrationName, "migration.sql")))
      .digest("hex"),
  );
  assert.deepEqual(
    (await columns()).filter((row) =>
      beforeColumns.some((old) => old.table_name === row.table_name),
    ),
    beforeColumns,
  );
  assert.deepEqual(
    await db.page.findUnique({ where: { id: fixture.id } }),
    fixture,
  );
  // Generate the pre-editorial datamodel independently; do not test old-client
  // compatibility solely through a regenerated editorial client.
  const legacySchema = resolve(temporary, "legacy.prisma");
  const canonicalSchema = readFileSync(
    resolve(root, "packages/db/prisma/schema.prisma"),
    "utf8",
  );
  const editorialStart = canonicalSchema.indexOf(
    "model ContentEditorialState {",
  );
  assert(editorialStart > 0, "Expected explicit pre-editorial model boundary");
  writeFileSync(
    legacySchema,
    canonicalSchema
      .slice(0, editorialStart)
      .replace(/^.*back_Content.*\r?\n/gm, "")
      .replace(
        'output   = "../generated/prisma"',
        'output   = "./legacy-client"',
      ),
  );
  cli(["generate", "--schema", legacySchema]);
  const legacyCheck = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      `import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from ${JSON.stringify(pathToFileURL(resolve(temporary, "legacy-client/client.ts")).href)};
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const page = await client.page.findUniqueOrThrow({ where: { id: "b043-preservation" } });
  assert.equal(page.content, "legacy");
  assert.equal(page.publishedAt.toISOString(), "2020-01-01T00:00:00.000Z");
  await client.page.update({ where: { id: page.id }, data: { title: "Old generated client update" } });
} finally {
  await client.$disconnect();
}`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(
    legacyCheck.status,
    0,
    "Pre-editorial generated PrismaPg read/write compatibility (credentials suppressed)",
  );
  await db.page.update({
    where: { id: fixture.id },
    data: { title: "Legacy update still works" },
  });
  assert.equal(await db.contentRevision.count(), 0);
  const coordination = "20261116140000_legacy_backfill_coordination";
  cpSync(resolve(source, coordination), resolve(migrations, coordination), {
    recursive: true,
  });
  cli(["migrate", "deploy"]);
  cli([
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    resolve(root, "packages/db/prisma/schema.prisma"),
    "--exit-code",
  ]);

  const failureName = "20261116130000_disposable_failure_probe";
  const failure = resolve(migrations, failureName);
  mkdirSync(failure);
  writeFileSync(
    resolve(failure, "migration.sql"),
    "BEGIN; CREATE TABLE b043_failure_probe(id integer); SELECT 1/0; COMMIT;",
  );
  cli(["migrate", "deploy"], false);
  assert.deepEqual(
    await db.$queryRaw`SELECT to_regclass('public.b043_failure_probe')::text AS name`,
    [{ name: null }],
  );
  cli(["migrate", "deploy"], false);
  cli(["migrate", "resolve", "--rolled-back", failureName]);
  writeFileSync(
    resolve(failure, "migration.sql"),
    "BEGIN; CREATE TABLE b043_failure_probe(id integer); COMMIT;",
  );
  cli(["migrate", "deploy"]);
  await db.$executeRaw`DROP TABLE b043_failure_probe`;
  await db.page.delete({ where: { id: fixture.id } });
  console.log(
    "Migration verification: eleven original checksums, fresh chain, expansion, preservation, no-op, PrismaPg, drift and failed-history recovery passed",
  );
}
