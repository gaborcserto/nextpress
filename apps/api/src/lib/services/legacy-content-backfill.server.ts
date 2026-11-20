import "server-only";

import { prisma } from "@nextpress/db/src/client";

import { persistFencedLegacyPage } from "./legacy-backfill-persistence.server";
import { BackfillConflictError } from "./legacy-backfill-planning.server";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

import type { BackfillOwnership } from "./legacy-backfill-fence.server";

export {
  BackfillConflictError,
  dryRunLegacyBackfill,
  inspectLegacyPage,
  mapLegacyRevisionHistory,
  planLegacyPage,
  reconcileLegacyContent,
} from "./legacy-backfill-planning.server";

export async function backfillLegacyContent(options: {
  db?: PrismaClient;
  ownership?: BackfillOwnership;
  pageIds?: readonly string[];
}) {
  if (!options.ownership || !options.pageIds?.length) {
    throw new BackfillConflictError("BACKFILL_FENCE_REQUIRED");
  }

  const results = [];

  for (const pageId of options.pageIds) {
    const state = await persistFencedLegacyPage(
      options.db ?? prisma,
      pageId,
      options.ownership,
    );
    results.push({ pageId, state });
  }

  return results;
}
