export function assertDevelopmentSeedAllowed(environment: NodeJS.ProcessEnv): void {
  if (environment.NODE_ENV === "production") {
    throw new Error("Development content seeding is disabled in production");
  }

  if (environment.ALLOW_DEVELOPMENT_CONTENT_SEED !== "true") {
    throw new Error("Set ALLOW_DEVELOPMENT_CONTENT_SEED=true to seed local development content");
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(environment.DATABASE_URL ?? "");
  } catch {
    throw new Error("Development content seeding requires the local PostgreSQL database");
  }
  const localDatabase = databaseUrl.pathname === "/cms"
    || /^\/nextpress_dev_verify_[a-z0-9_]+$/.test(databaseUrl.pathname);
  if (!["postgresql:", "postgres:"].includes(databaseUrl.protocol) || ![
    "localhost", "127.0.0.1", "::1",
  ].includes(databaseUrl.hostname) || !localDatabase) {
    throw new Error("Development content seeding is restricted to local cms or nextpress_dev_verify_* PostgreSQL databases");
  }
}
