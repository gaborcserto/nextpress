import "server-only";

import { randomUUID } from "node:crypto";

import { WorkingAggregateSchema } from "@/lib/validation/working-aggregate";

import { WorkingAggregateConflictError } from "./working-aggregate";
import {
  loadWorkingAggregate,
  saveWorkingAggregate,
} from "./working-aggregate-persistence.server";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

/** No claims or leases: each release either commits with its receipt or remains due. */
export async function executeDuePrivateReleases(db: PrismaClient) {
  const started = Date.now();
  const candidates = await db.$queryRaw<
    { pageId: string; aggregate: unknown }[]
  >`
    SELECT "pageId", aggregate FROM (
      SELECT DISTINCT ON ("pageId") "pageId", aggregate
      FROM "NPWorkingRevision" ORDER BY "pageId", version DESC
    ) latest WHERE aggregate->'release'->>'state' = 'PENDING'
      AND (aggregate->'release'->>'scheduledFor')::timestamptz <= now()
    ORDER BY aggregate->'release'->>'scheduledFor', "pageId" LIMIT 20`;
  const results: {
    pageId: string;
    outcome: "executed" | "refused";
    code?: string;
  }[] = [];

  for (const candidate of candidates) {
    if (Date.now() - started > 30000) {
      break;
    }
    const release = WorkingAggregateSchema.parse(candidate.aggregate).release;

    if (!release) {
      continue;
    }
    const actor = { id: release.actorId, role: release.actorRole };

    try {
      const current = await loadWorkingAggregate(db, candidate.pageId, actor);

      if (
        current.aggregate.release?.id !== release.id ||
        current.aggregate.release.state !== "PENDING"
      ) {
        continue;
      }
      await saveWorkingAggregate(
        db,
        {
          pageId: candidate.pageId,
          requestId: randomUUID(),
          operation: "EXECUTE",
          expectedDraftVersion: current.version,
          expectedSourceVersion: current.sourceVersion,
          edit: {
            expectedVersion: current.aggregate.baseVersion,
            expectedFingerprint: current.aggregate.baseFingerprint,
            patch: {},
          },
        },
        actor,
        { scheduledExecution: true },
      );
      results.push({ pageId: candidate.pageId, outcome: "executed" });
    } catch (error) {
      results.push({
        pageId: candidate.pageId,
        outcome: "refused",
        code:
          error instanceof WorkingAggregateConflictError
            ? error.message
            : "EXECUTION_REFUSED",
      });
    }
  }

  return {
    results,
    remainingMayExist:
      candidates.length === 20 || results.length < candidates.length,
  };
}
