import "server-only";

import { z } from "zod";

import {
  assertBackfillOwnership,
  BackfillFenceError,
  lockBackfillDomain,
  renewBackfillOwnership,
  verifyBackfillDatabase,
  type BackfillOwnership,
} from "./legacy-backfill-fence.server";
import { persistFencedLegacyPage } from "./legacy-backfill-persistence.server";
import {
  BackfillConflictError,
  inspectLegacyPage,
} from "./legacy-content-backfill.server";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

export const LegacyExecutionSchema = z.object({
  pageIds: z.array(z.string().min(1).max(191)).min(1).max(1000),
  batchSize: z.number().int().min(1).max(100).default(10),
  maxBatches: z.number().int().min(1).max(100).default(1),
});

/** No writes, including no fence acquisition. Use before scheduling an execution. */
export async function preflightLegacyExecution(db: PrismaClient) {
  await verifyBackfillDatabase(db);

  try {
    const [result] = await db.$queryRaw<{ valid: boolean }[]>`
      SELECT
        NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL)
        AND (SELECT count(DISTINCT migration_name) = 3 FROM "_prisma_migrations"
          WHERE migration_name IN ('20261116120000_editorial_persistence_foundation',
            '20261116140000_legacy_backfill_coordination', '20261116160000_legacy_writer_ownership')
          AND finished_at IS NOT NULL AND rolled_back_at IS NULL)
        AND has_sequence_privilege(current_user, '"LegacyBackfillFence_generation_seq"', 'USAGE')
        AND has_function_privilege(current_user, 'public.guard_legacy_backfill_mutation()', 'EXECUTE')
        AND has_schema_privilege(current_user, 'public', 'USAGE')
        AND has_table_privilege(current_user, '"ContentEditorialState"', 'UPDATE')
        AND NOT EXISTS (
          SELECT 1 FROM unnest(ARRAY['Page','PageRevision','PageOnTaxonomy','PageMedia','Media','Taxonomy','User',
            'ContentRevision','ContentEditorialState','ContentDraft','ContentPublication','ContentSlugReservation',
            'ContentLegacyRevisionImport','ContentRevisionMedia','ContentRevisionTaxonomy','ContentRevisionPageReference',
            'ContentMigrationCheckpoint','ContentScheduledRelease','ContentEditLease','ContentEditLeaseEvent','EditorialOperation',
            'LegacyBackfillFence']) AS tables(name)
          WHERE NOT has_table_privilege(current_user, format('public.%I', name), 'SELECT')
        )
        AND NOT EXISTS (
          SELECT 1 FROM unnest(ARRAY['ContentRevision','ContentEditorialState','ContentDraft','ContentPublication',
            'ContentSlugReservation','ContentLegacyRevisionImport','ContentRevisionMedia','ContentRevisionTaxonomy',
            'ContentRevisionPageReference','ContentMigrationCheckpoint']) AS tables(name)
          WHERE NOT has_table_privilege(current_user, format('public.%I', name), 'INSERT')
        )
        AND has_table_privilege(current_user, '"LegacyBackfillFence"', 'UPDATE') AS valid`;

    if (!result?.valid) {
      throw new BackfillFenceError("BACKFILL_PREFLIGHT_FAILED");
    }
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await lockBackfillDomain(tx);
    });
  } catch {
    throw new BackfillFenceError("BACKFILL_PREFLIGHT_FAILED");
  }
}

/** Bounded explicit cohort; checkpoints are evidence to revalidate, never a trusted cursor. */
export async function inspectLegacyExecution(db: PrismaClient, input: unknown) {
  const options = LegacyExecutionSchema.parse(input);
  await preflightLegacyExecution(db);

  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const records = [];

      for (const pageId of [...new Set(options.pageIds)].sort()) {
        const result = await inspectLegacyPage(tx, pageId);
        records.push({
          pageId,
          completed: result.populated && result.issues.length === 0,
          blocked:
            result.plan.issues.length > 0 ||
            (result.populated && result.issues.length > 0) ||
            result.issues.includes("SLUG_CONFLICT"),
          issues: result.issues,
        });
      }

      return records;
    },
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
}

/** Does not release the fence: partial runs and failures must retain the global freeze. */
export async function executeLegacyBatches(
  db: PrismaClient,
  ownership: BackfillOwnership,
  input: unknown,
) {
  const options = LegacyExecutionSchema.parse(input);
  await renewBackfillOwnership(db, ownership);
  const records = await inspectLegacyExecution(db, options);

  if (records.some((record) => record.blocked)) {
    throw new BackfillConflictError("BACKFILL_PREFLIGHT_CONFLICT");
  }
  const pending = records.filter((record) => !record.completed);
  const selected = pending.slice(0, options.batchSize * options.maxBatches);
  const results = [];

  for (const record of selected) {
    await renewBackfillOwnership(db, ownership);
    let state: string | undefined;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        state = await persistFencedLegacyPage(db, record.pageId, ownership);
        break;
      } catch (error) {
        if (
          !(error instanceof BackfillConflictError) ||
          error.code !== "BACKFILL_TRANSACTION_RETRY_REQUIRED" ||
          attempt === 2
        ) {
          throw error;
        }
        await renewBackfillOwnership(db, ownership);
      }
    }
    results.push({ pageId: record.pageId, state });
  }

  await renewBackfillOwnership(db, ownership);
  const parity = await inspectLegacyExecution(db, options);

  if (parity.some((record) => record.blocked)) {
    throw new BackfillConflictError("BACKFILL_FINAL_PARITY_FAILED");
  }
  await db.$transaction(async (tx) => {
    await lockBackfillDomain(tx);
    await assertBackfillOwnership(tx, ownership);
  });

  return {
    results,
    remaining: parity.filter((record) => !record.completed).length,
    complete: parity.every((record) => record.completed),
  };
}
