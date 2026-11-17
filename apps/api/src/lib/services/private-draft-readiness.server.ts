import "server-only";

import { WorkingAggregateSchema } from "@/lib/validation/working-aggregate";

import {
  BackfillConflictError,
  inspectLegacyPage,
} from "./legacy-content-backfill.server";
import {
  assertWorkingAggregateBase,
  captureWorkingAggregate,
} from "./working-aggregate";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

/** A read-only inventory, never enrollment or an assertion of deployment readiness. */
export async function reconcilePrivateDraftReadiness(db: PrismaClient) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const sources = await tx.page.findMany({
        include: { taxonomies: { include: { taxonomy: true } }, gallery: true },
        orderBy: { id: "asc" },
      });
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
          const inspected = await inspectLegacyPage(tx, source.id);

          if (inspected.populated) {
            issues.push(...inspected.issues.map((issue) => `SHADOW:${issue}`));
          } else {
            issues.push(
              ...inspected.plan.issues.map((issue) => `LEGACY:${issue}`),
            );
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
          select: { version: true, aggregate: true },
        });

        for (const revision of revisions) {
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
        shadowRecords: records.filter(
          (record) => record.enrollmentState === "SHADOW",
        ).length,
        clean: records.every((record) => record.issues.length === 0),
        deploymentReady: false,
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
}
