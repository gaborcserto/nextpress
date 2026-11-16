import "server-only";

import {
  assertBackfillOwnership,
  lockBackfillDomain,
  verifyBackfillDatabase,
  type BackfillOwnership,
} from "./legacy-backfill-fence.server";
import {
  BackfillConflictError,
  inspectLegacyPage,
} from "./legacy-content-backfill.server";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

/** READY is a sealed maintenance state, not runtime activation. No ENROLLED transition exists. */
export async function transitionLegacyOwnership(
  db: PrismaClient,
  ownership: BackfillOwnership,
  pageId: string,
  target: "SHADOW" | "READY",
) {
  await verifyBackfillDatabase(db);

  if (target !== "SHADOW" && target !== "READY") {
    throw new BackfillConflictError("EDITORIAL_ACTIVATION_DISABLED");
  }

  return db.$transaction(
    async (tx) => {
      await lockBackfillDomain(tx);
      await assertBackfillOwnership(tx, ownership);
      const state = await tx.contentEditorialState.findUnique({
        where: { pageId },
      });

      if (
        !state ||
        !["SHADOW", "READY"].includes(state.enrollmentState) ||
        state.enrollmentEpoch !== 0 ||
        state.enrolledAt !== null
      ) {
        throw new BackfillConflictError("UNSUPPORTED_OWNERSHIP_STATE");
      }

      // Compare against the imported SHADOW baseline before either sealing or returning ownership.
      // A failed comparison rolls this temporary normalization back with the transaction.
      if (state.enrollmentState === "READY") {
        await tx.contentEditorialState.update({
          where: { pageId },
          data: { enrollmentState: "SHADOW" },
        });
      }
      const inspected = await inspectLegacyPage(tx, pageId);

      if (!inspected.populated || inspected.issues.length) {
        throw new BackfillConflictError("OWNERSHIP_PARITY_REQUIRED");
      }
      await tx.contentEditorialState.update({
        where: { pageId },
        data: { enrollmentState: target },
      });
      await assertBackfillOwnership(tx, ownership);

      return { pageId, enrollmentState: target };
    },
    { timeout: 15000 },
  );
}
