export function getDatabaseConnectionString(environment: NodeJS.ProcessEnv): string {
  const value = environment.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is not set");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  return value;
}
