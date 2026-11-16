import "server-only";

import {
  assertBackfillOwnership,
  BackfillFenceError,
  lockBackfillDomain,
  verifyBackfillDatabase,
  type BackfillOwnership,
} from "./legacy-backfill-fence.server";
import {
  BackfillConflictError,
  inspectLegacyPage,
} from "./legacy-content-backfill.server";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

/** The database gate precedes capture; Read Committed observes writers drained by the gate. */
export async function persistFencedLegacyPage(
  db: PrismaClient,
  pageId: string,
  ownership: BackfillOwnership,
) {
  await verifyBackfillDatabase(db);

  return db
    .$transaction(
      async (tx) => {
        await lockBackfillDomain(tx);
        await assertBackfillOwnership(tx, ownership);
        const { plan, populated, issues } = await inspectLegacyPage(tx, pageId);

        if (populated) {
          if (issues.length) {
            throw new BackfillConflictError("EXISTING_TARGET_CONFLICT");
          }

          await assertBackfillOwnership(tx, ownership);

          return "existing";
        }
        if (plan.issues.length || issues.includes("SLUG_CONFLICT")) {
          throw new BackfillConflictError("UNRESOLVED_SOURCE");
        }
        const capturedAt = new Date();

        for (const revision of plan.revisions) {
          const { aggregate, provenance: _provenance, ...data } = revision;
          // SQL NULL for historical aggregate/provenance, JSON for complete baseline snapshots.
          await tx.contentRevision.create({
            data: { ...data, ...(aggregate === null ? {} : { aggregate }) },
          });
        }
        await tx.contentEditorialState.create({ data: plan.state });
        await tx.contentDraft.create({ data: plan.draft });
        await tx.contentPublication.createMany({ data: plan.publications });
        await tx.contentSlugReservation.createMany({
          data: plan.slugs.map((row) => ({
            ...row,
            createdAt: plan.state.updatedAt,
          })),
        });
        await tx.contentLegacyRevisionImport.createMany({
          data: plan.imports.map((row) => ({
            ...row,
            importedAt: capturedAt,
          })),
        });
        await tx.contentRevisionMedia.createMany({ data: plan.media });
        await tx.contentRevisionTaxonomy.createMany({ data: plan.taxonomies });
        await tx.contentRevisionPageReference.createMany({ data: plan.pages });
        await tx.contentMigrationCheckpoint.create({
          data: {
            ...plan.checkpoint,
            capturedAt,
            verifiedAt: capturedAt,
          },
        });
        const verified = await inspectLegacyPage(tx, pageId);

        if (verified.issues.length) {
          throw new BackfillConflictError("POST_WRITE_RECONCILIATION_FAILED");
        }

        await assertBackfillOwnership(tx, ownership);

        return "created";
      },
      { isolationLevel: "ReadCommitted", timeout: 15000 },
    )
    .catch((error: unknown) => {
      if (
        error instanceof BackfillConflictError ||
        error instanceof BackfillFenceError
      ) {
        throw error;
      }
      if (typeof error === "object" && error !== null && "code" in error) {
        if (error.code === "P2003") {
          throw new BackfillConflictError("REFERENCE_INTEGRITY_CONFLICT");
        }
        if (error.code === "P2002") {
          throw new BackfillConflictError("EXISTING_TARGET_CONFLICT");
        }
        if (error.code === "P2034") {
          throw new BackfillConflictError(
            "BACKFILL_TRANSACTION_RETRY_REQUIRED",
          );
        }
      }
      throw new BackfillConflictError("BACKFILL_DATABASE_FAILURE");
    });
}
