import "server-only";

import { canonicalEditorialJson } from "@nextpress/shared/editorial-contracts";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import {
  contentWriteWhere,
  ContentNotFoundError,
} from "@/lib/auth/content-access";
import {
  WorkingAggregateSaveSchema,
  WorkingAggregateSchema,
} from "@/lib/validation/working-aggregate";

import { mapEditorialReferenceEdges } from "./legacy-content-backfill.server";
import {
  assertWorkingAggregateBase,
  captureWorkingAggregate,
  prepareWorkingAggregateEdit,
  WorkingAggregateConflictError,
} from "./working-aggregate";
import { workingPersistenceFailure } from "./working-persistence-errors";

import type {
  Prisma,
  PrismaClient,
} from "@nextpress/db/generated/prisma/client";

import type { ContentActor } from "@/lib/auth/content-access";

const storedSchema = z.object({
  version: z.number().int().positive(),
  sourceVersion: z.number().int().nonnegative(),
  requestHash: z.string(),
  aggregate: WorkingAggregateSchema,
});

function persistenceFailure(error: unknown): never {
  const failure = workingPersistenceFailure(error);

  if (failure) {
    throw new WorkingAggregateConflictError(failure);
  }
  throw error;
}

async function lockSource(
  tx: Prisma.TransactionClient,
  pageId: string,
  actor: ContentActor,
) {
  const scope = contentWriteWhere(actor);
  const [policy] = await tx.$queryRaw<{ ready: boolean }[]>`
    SELECT count(*) = 26 AS ready FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND t.tgenabled = 'A' AND NOT t.tgisinternal AND (
      (c.relname IN ('Page','PageRevision','PageOnTaxonomy','PageMedia') AND t.tgname = 'private_source_mutation') OR
      (c.relname = 'Page' AND t.tgname = 'private_source_insert') OR
      (c.relname IN ('NPWorkingRevision','NPWorkingMedia','NPWorkingTaxonomy','NPWorkingPage') AND t.tgname IN ('private_history_immutable','private_maintenance_guard')) OR
      (c.relname = 'Taxonomy' AND t.tgname = 'private_taxonomy_type') OR
      (c.relname IN ('Page','PageRevision','PageOnTaxonomy','PageMedia','Media','Taxonomy','User') AND t.tgname = 'legacy_backfill_guard') OR
      (c.relname IN ('Page','PageRevision','PageOnTaxonomy','PageMedia') AND t.tgname = 'private_source_no_truncate') OR
      (c.relname = 'NPContentFence' AND t.tgname = 'private_fence_retained'))`;

  if (!policy?.ready) {
    throw new WorkingAggregateConflictError("WRITER_FENCE_UNAVAILABLE");
  }
  // Same shared maintenance gate as the legacy statement guards; never take its exclusive side.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(71520260503::bigint)`;
  const maintenance = await tx.$queryRaw<{ available: boolean }[]>`
    SELECT (owner IS NULL AND NOT EXISTS (
      SELECT 1 FROM "ContentEditorialState" WHERE "enrollmentState" <> 'SHADOW'
    )) AS available FROM "LegacyBackfillFence" WHERE id = 1 FOR SHARE`;

  if (maintenance.length !== 1 || !maintenance[0]?.available) {
    throw new WorkingAggregateConflictError("MAINTENANCE_CONFLICT");
  }
  const fences = await tx.$queryRaw<{ version: number }[]>`
    SELECT version FROM "NPContentFence" WHERE "pageId" = ${pageId} FOR UPDATE`;

  if (fences.length !== 1 || !fences[0]) {
    throw new ContentNotFoundError();
  }
  // Legacy writers can already hold a Page/target row before reaching their
  // NOWAIT fence trigger. Never wait in the inverse direction here.
  await tx.$queryRaw`SELECT id FROM "Page" WHERE id = ${pageId} FOR SHARE NOWAIT`;
  const source = await tx.page.findFirst({
    where: { id: pageId, ...scope },
    include: { taxonomies: { include: { taxonomy: true } }, gallery: true },
  });

  if (!source) {
    throw new ContentNotFoundError();
  }

  return { source, sourceVersion: fences[0].version };
}

export async function loadWorkingAggregate(
  db: PrismaClient,
  pageId: string,
  actor: ContentActor,
  options: { includeSourceMetadata?: boolean } = {},
) {
  return db
    .$transaction(
      async (tx) => {
        const { source, sourceVersion } = await lockSource(tx, pageId, actor);
        const rows = await tx.$queryRaw<unknown[]>`
      SELECT version, "sourceVersion", "requestHash", aggregate FROM "NPWorkingRevision"
      WHERE "pageId" = ${pageId} ORDER BY version DESC LIMIT 1`;

        const stored = rows.length
          ? storedSchema.parse(rows[0])
          : {
              version: 0,
              sourceVersion,
              aggregate: captureWorkingAggregate(source),
            };

        if (
          stored.aggregate.ownerId !== source.authorId ||
          stored.aggregate.kind !== source.type
        ) {
          throw new WorkingAggregateConflictError("IDENTITY_CONFLICT");
        }
        const tagLabels = options.includeSourceMetadata
          ? await tx.taxonomy.findMany({
              where: {
                id: { in: stored.aggregate.snapshot.relationships.tagIds },
                type: "TAG",
              },
              select: { id: true, name: true, slug: true },
              orderBy: { id: "asc" },
            })
          : undefined;

        return {
          version: stored.version,
          sourceVersion: stored.sourceVersion,
          aggregate: stored.aggregate,
          ...(options.includeSourceMetadata
            ? { currentSourceVersion: sourceVersion, tagLabels }
            : {}),
        };
      },
      { isolationLevel: "ReadCommitted" },
    )
    .catch(persistenceFailure);
}

export async function saveWorkingAggregate(
  db: PrismaClient,
  input: unknown,
  actor: ContentActor,
) {
  const command = WorkingAggregateSaveSchema.parse(input);
  contentWriteWhere(actor);

  const requestHash = createHash("sha256")
    .update(
      canonicalEditorialJson({
        command,
        actor: { id: actor.id, role: actor.role },
      }),
    )
    .digest("hex");

  return db
    .$transaction(
      async (tx) => {
        const { source, sourceVersion } = await lockSource(
          tx,
          command.pageId,
          actor,
        );
        const replay = await tx.$queryRaw<unknown[]>`
      SELECT version, "sourceVersion", "requestHash", aggregate FROM "NPWorkingRevision"
      WHERE "pageId" = ${command.pageId} AND "requestId" = ${command.requestId}::uuid`;

        if (replay.length) {
          const stored = storedSchema.parse(replay[0]);

          if (
            stored.requestHash !== requestHash ||
            stored.aggregate.ownerId !== source.authorId ||
            stored.aggregate.kind !== source.type
          ) {
            throw new WorkingAggregateConflictError("REQUEST_REUSE_CONFLICT");
          }

          return {
            version: stored.version,
            sourceVersion: stored.sourceVersion,
            aggregate: stored.aggregate,
          };
        }
        const rows = await tx.$queryRaw<unknown[]>`
      SELECT version, "sourceVersion", "requestHash", aggregate FROM "NPWorkingRevision"
      WHERE "pageId" = ${command.pageId} ORDER BY version DESC LIMIT 1`;
        const current = rows.length
          ? storedSchema.parse(rows[0])
          : {
              version: 0,
              sourceVersion,
              aggregate: captureWorkingAggregate(source),
            };

        if (current.version !== command.expectedDraftVersion) {
          throw new WorkingAggregateConflictError("DRAFT_VERSION_CONFLICT");
        }

        if (
          sourceVersion !== command.expectedSourceVersion ||
          (command.operation !== "RESET" &&
            current.sourceVersion !== sourceVersion)
        ) {
          throw new WorkingAggregateConflictError("SOURCE_VERSION_CONFLICT");
        }

        if (command.operation !== "RESET") {
          assertWorkingAggregateBase(current.aggregate, source);
        }
        const edited = prepareWorkingAggregateEdit(
          current.aggregate,
          command.edit,
          actor,
        );

        if (
          command.operation === "RESET" &&
          (Object.keys(command.edit.patch).length > 0 ||
            command.edit.publicationIntent)
        ) {
          throw new WorkingAggregateConflictError("RESET_COMMAND_CONFLICT");
        }
        const aggregate =
          command.operation === "RESET"
            ? captureWorkingAggregate(source)
            : edited;
        const revisionId = randomUUID();
        const { edges } = mapEditorialReferenceEdges(
          revisionId,
          aggregate.snapshot,
        );
        // Stable table/id order. Retained foreign keys also protect references after commit.
        for (const id of [
          ...new Set(edges.media.map((edge) => edge.mediaId)),
        ].sort()) {
          const found = await tx.$queryRaw<
            unknown[]
          >`SELECT id FROM "Media" WHERE id = ${id} FOR KEY SHARE NOWAIT`;

          if (found.length !== 1) {
            throw new WorkingAggregateConflictError("REFERENCE_CONFLICT");
          }
        }

        for (const id of [
          ...new Set(edges.taxonomies.map((edge) => edge.taxonomyId)),
        ].sort()) {
          const found = await tx.$queryRaw<
            { type: string }[]
          >`SELECT type FROM "Taxonomy" WHERE id = ${id} FOR SHARE NOWAIT`;

          if (
            !found[0] ||
            edges.taxonomies.some(
              (edge) =>
                edge.taxonomyId === id &&
                edge.usage !== "LISTING" &&
                edge.usage !== found[0]?.type,
            )
          ) {
            throw new WorkingAggregateConflictError("REFERENCE_CONFLICT");
          }
        }

        for (const id of [
          ...new Set(edges.pages.map((edge) => edge.targetPageId)),
        ].sort()) {
          const found = await tx.$queryRaw<
            unknown[]
          >`SELECT id FROM "Page" WHERE id = ${id} FOR KEY SHARE NOWAIT`;

          if (found.length !== 1) {
            throw new WorkingAggregateConflictError("REFERENCE_CONFLICT");
          }
        }
        const version = current.version + 1;
        await tx.$executeRaw`INSERT INTO "NPWorkingRevision"
      (id, "pageId", version, "sourceVersion", "requestId", "requestHash", aggregate)
      VALUES (${revisionId}::uuid, ${command.pageId}, ${version}, ${sourceVersion},
        ${command.requestId}::uuid, ${requestHash}, ${JSON.stringify(aggregate)}::jsonb)`;

        for (const id of [
          ...new Set(edges.media.map((edge) => edge.mediaId)),
        ].sort()) {
          await tx.$executeRaw`INSERT INTO "NPWorkingMedia" VALUES (${revisionId}::uuid, ${id})`;
        }

        for (const id of [
          ...new Set(edges.taxonomies.map((edge) => edge.taxonomyId)),
        ].sort()) {
          await tx.$executeRaw`INSERT INTO "NPWorkingTaxonomy" VALUES (${revisionId}::uuid, ${id})`;
        }

        for (const id of [
          ...new Set(edges.pages.map((edge) => edge.targetPageId)),
        ].sort()) {
          await tx.$executeRaw`INSERT INTO "NPWorkingPage" VALUES (${revisionId}::uuid, ${id})`;
        }

        return { version, sourceVersion, aggregate };
      },
      { isolationLevel: "ReadCommitted", timeout: 15000 },
    )
    .catch(persistenceFailure);
}
