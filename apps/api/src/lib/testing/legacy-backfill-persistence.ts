import "server-only";

import { disposableDatabaseName } from "./disposable-database";
import { verifyDisposableDatabase } from "./docker-database";
import {
  acquireBackfillOwnership,
  releaseBackfillOwnership,
} from "../services/legacy-backfill-fence.server";
import { persistFencedLegacyPage } from "../services/legacy-backfill-persistence.server";
import { BackfillConflictError } from "../services/legacy-content-backfill.server";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

/** Additional disposable identity proof is mandatory even though the core also verifies its target. */
export async function persistLegacyPageInDisposableDatabase(
  db: PrismaClient,
  pageId: string,
) {
  if (process.env.NODE_ENV !== "test") {
    throw new BackfillConflictError("ISOLATED_TEST_ONLY");
  }
  const name = disposableDatabaseName(
    process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL,
    process.env.DATABASE_URL,
    "content",
  );
  await verifyDisposableDatabase(name, db);
  const ownership = await acquireBackfillOwnership(db);

  try {
    return await persistFencedLegacyPage(db, pageId, ownership);
  } finally {
    await releaseBackfillOwnership(db, ownership);
  }
}
