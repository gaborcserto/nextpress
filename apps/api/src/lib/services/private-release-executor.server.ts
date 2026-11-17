import "server-only";

import { randomUUID } from "node:crypto";

import { ExecutePrivateReleasesSchema } from "@/lib/validation/private-release";
import { WorkingAggregateSchema } from "@/lib/validation/working-aggregate";

import { WorkingAggregateConflictError } from "./working-aggregate";
import {
  loadWorkingAggregate,
  saveWorkingAggregate,
} from "./working-aggregate-persistence.server";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

/** No claims or leases: each release either commits with its receipt or remains due. */
export async function executeDuePrivateReleases(
  db: PrismaClient,
  input: unknown = {},
) {
  const { after } = ExecutePrivateReleasesSchema.parse(input);
  let nextCursor = after ?? null;
  const started = Date.now();
  const candidates = await db.$transaction(
    (tx) => tx.$queryRaw<{ pageId: string; aggregate: unknown }[]>`
    SELECT "pageId", aggregate FROM (
      SELECT DISTINCT ON ("pageId") "pageId", aggregate
      FROM "NPWorkingRevision" ORDER BY "pageId", version DESC
    ) latest WHERE aggregate->'release'->>'state' = 'PENDING'
      AND (aggregate->'release'->>'scheduledFor')::timestamptz <= now()
      AND (${after?.pageId ?? null}::text IS NULL OR
        (aggregate->'release'->>'scheduledFor', "pageId") >
        (${after?.scheduledFor ?? null}, ${after?.pageId ?? null}))
    ORDER BY aggregate->'release'->>'scheduledFor', "pageId" LIMIT 20`,
    { timeout: 5000 },
  );
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
    nextCursor = {
      scheduledFor: release.scheduledFor,
      pageId: candidate.pageId,
    };
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
    nextCursor:
      candidates.length === 20 || results.length < candidates.length
        ? nextCursor
        : null,
    remainingMayExist:
      candidates.length === 20 || results.length < candidates.length,
  };
}
