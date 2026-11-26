import "server-only";

import { randomUUID } from "node:crypto";

import {
  BackfillFenceError,
  verifyBackfillDatabase,
} from "./legacy-backfill-identity.server";

import type {
  Prisma,
  PrismaClient,
} from "@nextpress/db/generated/prisma/client";

export type BackfillOwnership = { owner: string; generation: bigint };
type FenceRow = BackfillOwnership & { expiresAt: Date };

const protectedTables = [
  "Page",
  "PageRevision",
  "PageOnTaxonomy",
  "PageMedia",
  "Media",
  "Taxonomy",
  "User",
];

// Keep equal to the migration body: missing, disabled or replaced guards fail closed.
const guardBody = `
BEGIN
  PERFORM pg_advisory_xact_lock_shared(71520260503::bigint);
  PERFORM 1 FROM public."LegacyBackfillFence" WHERE id = 1 FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P5502', MESSAGE = 'BACKFILL_COORDINATION_UNAVAILABLE';
  END IF;
  IF EXISTS (SELECT 1 FROM public."LegacyBackfillFence" WHERE id = 1 AND owner IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P5501', MESSAGE = 'BACKFILL_WRITER_HELD';
  END IF;
  IF EXISTS (SELECT 1 FROM public."ContentEditorialState" WHERE "enrollmentState" <> 'SHADOW') THEN
    RAISE EXCEPTION USING ERRCODE = 'P5503', MESSAGE = 'EDITORIAL_WRITER_OWNED';
  END IF;
  RETURN NULL;
END
`;

export async function lockBackfillDomain(tx: Prisma.TransactionClient) {
  // Must precede row locks and source capture. Database triggers take the shared side.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(71520260503::bigint)`;
  const coverage = await tx.$queryRaw<
    { table: string; body: string; valid: boolean }[]
  >`
    SELECT c.relname AS table, p.prosrc AS body,
      (t.tgenabled = 'A' AND t.tgtype = 62 AND n.nspname = 'public' AND p.proname = 'guard_legacy_backfill_mutation') AS valid
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgname = 'legacy_backfill_guard' AND NOT t.tgisinternal`;

  if (
    coverage.length !== protectedTables.length ||
    protectedTables.some(
      (table) =>
        !coverage.some(
          (item) =>
            item.table === table &&
            item.valid &&
            item.body.replace(/\r\n/g, "\n").trim() ===
              guardBody.replace(/\r\n/g, "\n").trim(),
        ),
    )
  ) {
    throw new BackfillFenceError("BACKFILL_COORDINATION_UNAVAILABLE");
  }
}

export async function assertBackfillOwnership(
  tx: Prisma.TransactionClient,
  ownership: BackfillOwnership,
) {
  const rows = await tx.$queryRaw<FenceRow[]>`
    SELECT owner::text, generation, "expiresAt" FROM "LegacyBackfillFence"
    WHERE id = 1 AND owner = ${ownership.owner}::uuid AND generation = ${ownership.generation}
      AND "expiresAt" > clock_timestamp() FOR UPDATE`;

  if (rows.length !== 1) {
    throw new BackfillFenceError("BACKFILL_OWNERSHIP_LOST");
  }
}

export async function acquireBackfillOwnership(
  db: PrismaClient,
): Promise<BackfillOwnership> {
  await verifyBackfillDatabase(db);

  return db.$transaction(async (tx) => {
    await lockBackfillDomain(tx);
    const owner = randomUUID();

    const rows = await tx.$queryRaw<FenceRow[]>`
      UPDATE "LegacyBackfillFence" SET owner = ${owner}::uuid,
        generation = nextval('"LegacyBackfillFence_generation_seq"'), "expiresAt" = clock_timestamp() + interval '60 seconds'
      WHERE id = 1 AND (owner IS NULL OR "expiresAt" <= clock_timestamp())
      RETURNING owner::text, generation, "expiresAt"`;
    const row = rows[0];

    if (!row) {
      throw new BackfillFenceError("BACKFILL_OWNERSHIP_BUSY");
    }

    return { owner: row.owner, generation: row.generation };
  });
}

export async function renewBackfillOwnership(
  db: PrismaClient,
  ownership: BackfillOwnership,
) {
  await verifyBackfillDatabase(db);
  await db.$transaction(async (tx) => {
    await lockBackfillDomain(tx);
    await assertBackfillOwnership(tx, ownership);
    await tx.$executeRaw`UPDATE "LegacyBackfillFence" SET "expiresAt" = clock_timestamp() + interval '60 seconds' WHERE id = 1`;
  });
}

export async function releaseBackfillOwnership(
  db: PrismaClient,
  ownership: BackfillOwnership,
) {
  await verifyBackfillDatabase(db);
  await db.$transaction(async (tx) => {
    await lockBackfillDomain(tx);
    const count =
      await tx.$executeRaw`UPDATE "LegacyBackfillFence" SET owner = NULL, "expiresAt" = NULL,
      generation = nextval('"LegacyBackfillFence_generation_seq"')
      WHERE id = 1 AND owner = ${ownership.owner}::uuid AND generation = ${ownership.generation}`;

    if (count !== 1) {
      throw new BackfillFenceError("BACKFILL_OWNERSHIP_LOST");
    }
  });
}
