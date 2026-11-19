export function resolveDatabase(environment: NodeJS.ProcessEnv) {
  const value = environment.DATABASE_URL?.trim();

  if (!value) {
    throw new Error(
      "DATABASE_URL is not set. Set it in apps/api/.env or supply it in the process environment.",
    );
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    url.hash ||
    /%(?![a-f0-9]{2})/i.test(value)
  ) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  const schema = url.searchParams.get("schema") ?? "public";
  const database = url.pathname.slice(1);

  if (
    !database ||
    !schema ||
    url.searchParams.getAll("schema").length > 1 ||
    url.hostname.includes("%") ||
    url.searchParams.has("host") ||
    url.searchParams.has("port")
  ) {
    throw new Error(
      "DATABASE_URL must identify one PostgreSQL host, port, database and schema. Put the host and port in the URL authority.",
    );
  }

  // node-postgres otherwise falls back to PGPORT, while Prisma CLI defaults to 5432.
  if (!url.port) {
    url.port = "5432";
  }

  return {
    connectionString: url.href,
    target: { host: url.hostname, port: url.port, database, schema },
  };
}

export function formatDatabaseTarget(
  target: ReturnType<typeof resolveDatabase>["target"],
) {
  return `${target.host}:${target.port}/${target.database} (schema ${JSON.stringify(target.schema)})`;
}
