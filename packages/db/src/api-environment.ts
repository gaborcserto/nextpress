import { loadEnvConfig } from "@next/env";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { resolveDatabase } from "./database-config";

export function loadApiEnvironment(
  development = process.env.NODE_ENV !== "production",
) {
  let failed = false;

  loadEnvConfig(resolve(__dirname, "../../../apps/api"), development, {
    info() {},
    error() {
      failed = true;
    },
  });

  if (failed) {
    throw new Error(
      "Could not load the API environment. Check the syntax and permissions of apps/api/.env files.",
    );
  }
}

export function loadMigrationEnvironment() {
  const explicitDatabaseUrl = process.env.DATABASE_URL;

  loadApiEnvironment();
  const configuredTarget = resolveDatabase(process.env).target;
  const isEditorialTarget =
    configuredTarget.host === "127.0.0.1" &&
    configuredTarget.port === "55434" &&
    configuredTarget.database === "nextpress_dev_editorial";

  if (
    !explicitDatabaseUrl &&
    process.env.NODE_ENV !== "production" &&
    isEditorialTarget
  ) {
    const migrationEnvironmentPath = resolve(__dirname, "../.env.migrator");

    if (existsSync(migrationEnvironmentPath)) {
      const migrationEnvironment = config({
        path: migrationEnvironmentPath,
        processEnv: {},
        quiet: true,
      });
      const migrationUrl = migrationEnvironment.parsed?.MIGRATION_DATABASE_URL;

      if (migrationEnvironment.error || !migrationUrl) {
        throw new Error(
          "packages/db/.env.migrator must define MIGRATION_DATABASE_URL.",
        );
      }

      process.env.DATABASE_URL = migrationUrl;
    }
  }

  const { target } = resolveDatabase(process.env);
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");

  if (
    target.host === "127.0.0.1" &&
    target.port === "55434" &&
    target.database === "nextpress_dev_editorial" &&
    decodeURIComponent(databaseUrl.username) !== "nextpress_dev_migrator"
  ) {
    throw new Error(
      "Editorial migrations require the nextpress_dev_migrator credential in packages/db/.env.migrator or an explicit DATABASE_URL override.",
    );
  }
}
