import "server-only";

import { z } from "zod";

import { WorkingAggregateSchema } from "@/lib/validation/working-aggregate";

import { mapEditorialReferenceEdges } from "./editorial-mapping";
import {
  BackfillConflictError,
  inspectLegacyPage,
} from "./legacy-backfill/legacy-backfill-planning.server";
import {
  assertWorkingAggregateBase,
  captureWorkingAggregate,
} from "./working-aggregate";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

/** A read-only inventory, never enrollment or an assertion of deployment readiness. */
const inventoryOptionsSchema = z.strictObject({
  afterId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(100),
});

export async function reconcilePrivateDraftReadiness(
  db: PrismaClient,
  input: unknown = {},
) {
  const options = inventoryOptionsSchema.parse(input);

  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const cohort = await tx.page.findMany({
        where: options.afterId ? { id: { gt: options.afterId } } : {},
        take: options.limit + 1,
        include: { taxonomies: { include: { taxonomy: true } }, gallery: true },
        orderBy: { id: "asc" },
      });

      const sources = cohort.slice(0, options.limit);
      let complete = !options.afterId && cohort.length <= options.limit;

      const [targetBudget] = await tx.$queryRaw<{ exceeded: boolean }[]>`
        SELECT EXISTS(SELECT 1 FROM "Media" OFFSET 10000 LIMIT 1)
          OR EXISTS(SELECT 1 FROM "Taxonomy" OFFSET 10000 LIMIT 1)
          OR EXISTS(SELECT 1 FROM "Page" OFFSET 10000 LIMIT 1)
          OR EXISTS(SELECT 1 FROM "User" OFFSET 10000 LIMIT 1) AS exceeded`;
      const records = [];

      for (const source of sources) {
        const issues: string[] = [];
        const enrollment = await tx.contentEditorialState.findUnique({
          where: { pageId: source.id },
          select: { enrollmentState: true },
        });

        const enrollmentState = enrollment?.enrollmentState ?? "absent";

        if (enrollment && enrollment.enrollmentState !== "SHADOW") {
          issues.push("EDITORIAL:NON_SHADOW_ENROLLMENT");
        }

        try {
          captureWorkingAggregate(source);
        } catch {
          issues.push("UNSUPPORTED_WORKING_AGGREGATE");
        }

        try {
          const [historyBudget] = await tx.$queryRaw<{ exceeded: boolean }[]>`
            SELECT EXISTS(SELECT 1 FROM "PageRevision" WHERE "pageId" = ${source.id} OFFSET 100 LIMIT 1)
              OR EXISTS(SELECT 1 FROM "ContentRevision" WHERE "pageId" = ${source.id} OFFSET 100 LIMIT 1) AS exceeded`;

          if (targetBudget?.exceeded || historyBudget?.exceeded) {
            complete = false;
            issues.push("LEGACY:INVENTORY_LIMIT_EXCEEDED");
          } else {
            const inspected = await inspectLegacyPage(tx, source.id);

            if (inspected.populated) {
              issues.push(
                ...inspected.issues.map((issue) => `SHADOW:${issue}`),
              );
            } else {
              issues.push(
                ...inspected.plan.issues.map((issue) => `LEGACY:${issue}`),
              );
            }
          }
        } catch (error) {
          if (!(error instanceof BackfillConflictError)) {
            throw error;
          }

          issues.push(`LEGACY:${error.code}`);
        }

        const revisions = await tx.nPWorkingRevision.findMany({
          where: { pageId: source.id },
          orderBy: { version: "asc" },
          take: 101,
          select: {
            id: true,
            version: true,
            aggregate: true,
            media: { select: { targetId: true } },
            taxonomies: { select: { targetId: true } },
            pages: { select: { targetId: true } },
          },
        });

        if (revisions.length > 100) {
          complete = false;
          issues.push("PRIVATE:HISTORY_LIMIT_EXCEEDED");
        }

        for (const [index, revision] of revisions.slice(0, 100).entries()) {
          if (revision.version !== index + 1) {
            issues.push(`PRIVATE:${revision.version}:HISTORY_GAP`);
          }

          const parsed = WorkingAggregateSchema.safeParse(revision.aggregate);

          if (!parsed.success) {
            issues.push(`PRIVATE:${revision.version}:INVALID_AGGREGATE`);
            continue;
          }

          if (
            parsed.data.pageId !== source.id ||
            parsed.data.kind !== source.type ||
            parsed.data.ownerId !== source.authorId
          ) {
            issues.push(`PRIVATE:${revision.version}:IDENTITY_DRIFT`);
          }

          const { edges } = mapEditorialReferenceEdges(
            revision.id,
            parsed.data.snapshot,
          );
          const referenceSets = [
            {
              expected: edges.media.map((edge) => edge.mediaId),
              retained: revision.media,
            },
            {
              expected: edges.taxonomies.map((edge) => edge.taxonomyId),
              retained: revision.taxonomies,
            },
            {
              expected: edges.pages.map((edge) => edge.targetPageId),
              retained: revision.pages,
            },
          ];

          if (
            referenceSets.some(({ expected, retained }) => {
              const ids = new Set(expected);

              return (
                ids.size !== retained.length ||
                retained.some((edge) => !ids.has(edge.targetId))
              );
            })
          ) {
            issues.push(`PRIVATE:${revision.version}:REFERENCE_INDEX_MISMATCH`);
          }

          if (revision === revisions.at(-1)) {
            try {
              assertWorkingAggregateBase(parsed.data, source);
            } catch {
              issues.push("PRIVATE:SOURCE_DRIFT");
            }
          }
        }

        if (source.status === "PUBLISHED" && source.publishedAt === null) {
          issues.push("PUBLIC:LEGACY_UNDATED_ELIGIBILITY_DIVERGENCE");
        }

        records.push({
          id: source.id,
          kind: source.type,
          ownerId: source.authorId,
          enrollmentState,
          privateVersions: revisions.length,
          issues: [...new Set(issues)].sort(),
        });
      }

      return {
        records,
        complete,
        nextCursor:
          cohort.length > options.limit ? (sources.at(-1)?.id ?? null) : null,
        shadowRecords: records.filter(
          (record) => record.enrollmentState === "SHADOW",
        ).length,
        clean:
          complete && records.every((record) => record.issues.length === 0),
        deploymentReady: false,
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
}
