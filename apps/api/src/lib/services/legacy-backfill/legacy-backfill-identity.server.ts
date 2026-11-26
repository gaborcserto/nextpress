import "server-only";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

export class BackfillFenceError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Operator target configuration is independently compared with the live connection, never a fence claim. */
export async function verifyBackfillDatabase(db: PrismaClient) {
  const database = process.env.NEXTPRESS_BACKFILL_DATABASE_NAME;
  const cluster = process.env.NEXTPRESS_BACKFILL_CLUSTER_ID;
  const role = process.env.NEXTPRESS_BACKFILL_DATABASE_ROLE;

  if (
    !database ||
    !/^nextpress_[a-z0-9_]+$/.test(database) ||
    !cluster ||
    !/^\d+$/.test(cluster) ||
    !role
  ) {
    throw new BackfillFenceError("BACKFILL_IDENTITY_REQUIRED");
  }

  let connection: URL;

  try {
    connection = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new BackfillFenceError("BACKFILL_IDENTITY_MISMATCH");
  }

  if (
    connection.pathname !== `/${database}` ||
    connection.username !== role ||
    !["postgres:", "postgresql:"].includes(connection.protocol) ||
    connection.search ||
    connection.hash
  ) {
    throw new BackfillFenceError("BACKFILL_IDENTITY_MISMATCH");
  }

  const [identity] = await db.$queryRaw<
    { database: string; cluster: string; role: string; safe: boolean }[]
  >`
    SELECT current_database() AS database, (SELECT system_identifier::text FROM pg_control_system()) AS cluster,
    current_user AS role, NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR pg_is_in_recovery()) AS safe
    FROM pg_roles WHERE rolname = current_user`.catch(() => {
    throw new BackfillFenceError("BACKFILL_IDENTITY_UNVERIFIABLE");
  });

  if (
    !identity ||
    identity.database !== database ||
    identity.cluster !== cluster ||
    identity.role !== role ||
    !identity.safe
  ) {
    throw new BackfillFenceError("BACKFILL_IDENTITY_MISMATCH");
  }
}
