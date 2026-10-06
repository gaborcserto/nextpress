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
  if (![
    "localhost", "127.0.0.1", "::1",
  ].includes(databaseUrl.hostname) || databaseUrl.pathname !== "/cms") {
    throw new Error("Development content seeding is restricted to the local cms database");
  }
}
