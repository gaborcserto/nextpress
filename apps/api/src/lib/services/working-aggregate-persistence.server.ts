import "server-only";

import { pageLayouts } from "@nextpress/shared/content";
import { canonicalEditorialJson } from "@nextpress/shared/editorial-contracts";
import { documentMime } from "@nextpress/shared/media";
import { pageDocumentIds } from "@nextpress/shared/page-document";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import {
  contentWriteWhere,
  ContentForbiddenError,
  ContentNotFoundError,
} from "@/lib/auth/content-access";
import { PublicationFieldsSchema } from "@/lib/validation/page";
import {
  WorkingAggregateSaveSchema,
  WorkingAggregateSchema,
} from "@/lib/validation/working-aggregate";

import { mapEditorialReferenceEdges } from "./editorial-mapping";
import {
  assertWorkingAggregateBase,
  captureWorkingAggregate,
  prepareWorkingAggregateEdit,
  restoreLegacyWorkingAggregate,
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

async function lockPublicationActor(
  tx: Prisma.TransactionClient,
  actor: ContentActor,
) {
  const [privileges] = await tx.$queryRaw<{ ready: boolean }[]>`
    SELECT has_table_privilege('"PageRevision"', 'INSERT') AND
      has_table_privilege('"PageOnTaxonomy"', 'INSERT') AND
      has_table_privilege('"PageOnTaxonomy"', 'DELETE') AND
      has_function_privilege('public.np_lock_publication_actor(text)', 'EXECUTE') AND
      (SELECT bool_and(has_column_privilege('"Page"', column_name, 'UPDATE'))
        FROM unnest(ARRAY['title','slug','content','excerpt','layout','listingTaxonomyId','pageDocument',
          'inHeaderMenu','inFooterMenu','status','publishedAt','workingVersion','updatedAt']) AS column_name)
      AS ready`;

  if (!privileges?.ready) {
    throw new WorkingAggregateConflictError(
      "PUBLICATION_PRIVILEGES_UNAVAILABLE",
    );
  }

  const roles = await tx.$queryRaw<{ name: string }[]>`
    SELECT name FROM public.np_lock_publication_actor(${actor.id})`;

  if (!roles[0] || roles[0].name !== actor.role) {
    throw new ContentForbiddenError();
  }

  contentWriteWhere(actor);
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

        const { fields, relationships } = stored.aggregate.snapshot;
        const taxonomyIds = [
          ...relationships.tagIds,
          ...(fields.layout === pageLayouts.posts && fields.listingTaxonomyId
            ? [fields.listingTaxonomyId]
            : []),
        ];
        const tagLabels = options.includeSourceMetadata
          ? await tx.taxonomy.findMany({
              where: {
                id: { in: taxonomyIds },
                type: "TAG",
              },
              select: { id: true, name: true, slug: true },
              orderBy: { id: "asc" },
            })
          : undefined;
        const history = options.includeSourceMetadata
          ? await tx.$queryRaw<{ version: number; title: string }[]>`
              SELECT version, aggregate #>> '{snapshot,fields,title}' AS title
              FROM "NPWorkingRevision" WHERE "pageId" = ${pageId}
              ORDER BY version DESC LIMIT 100`
          : undefined;
        const legacyHistory = options.includeSourceMetadata
          ? await tx.pageRevision.findMany({
              where: { pageId },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 20,
            })
          : undefined;

        return {
          version: stored.version,
          sourceVersion: stored.sourceVersion,
          aggregate: stored.aggregate,
          ...(options.includeSourceMetadata
            ? {
                currentSourceVersion: sourceVersion,
                pendingPrivateChanges:
                  canonicalEditorialJson({
                    snapshot: stored.aggregate.snapshot,
                    raw: stored.aggregate.rawPageDocument,
                  }) !==
                  canonicalEditorialJson({
                    snapshot: captureWorkingAggregate(source).snapshot,
                    raw: source.pageDocument,
                  }),
                tagLabels,
                history: history?.map((revision) => ({
                  version: revision.version,
                  title: revision.title,
                })),
                legacyHistory: legacyHistory
                  ?.filter((revision) => {
                    try {
                      restoreLegacyWorkingAggregate(stored.aggregate, revision);

                      return true;
                    } catch (error) {
                      if (
                        error instanceof WorkingAggregateConflictError ||
                        error instanceof z.ZodError
                      ) {
                        return false;
                      }

                      throw error;
                    }
                  })
                  .map((revision) => ({
                    id: revision.id,
                    title: revision.title,
                    createdAt: revision.createdAt.toISOString(),
                  })),
              }
            : {}),
        };
      },
      { isolationLevel: "ReadCommitted", timeout: 5000 },
    )
    .catch(persistenceFailure);
}

export async function saveWorkingAggregate(
  db: PrismaClient,
  input: unknown,
  actor: ContentActor,
  options: { scheduledExecution?: boolean } = {},
) {
  const command = WorkingAggregateSaveSchema.parse(input);
  contentWriteWhere(actor);
  const lifecycle =
    command.operation !== undefined &&
    ["PUBLISH", "UNPUBLISH", "SCHEDULE", "CANCEL_SCHEDULE", "EXECUTE"].includes(
      command.operation,
    );

  if (
    (command.operation === "EXECUTE" && !options.scheduledExecution) ||
    (command.operation === "SCHEDULE") !==
      (command.scheduledFor !== undefined) ||
    (lifecycle &&
      (Object.keys(command.edit.patch).length > 0 ||
        command.edit.publicationIntent))
  ) {
    throw new WorkingAggregateConflictError("PUBLICATION_COMMAND_CONFLICT");
  }

  if (
    (command.operation === "RESTORE") !==
      (command.restoreVersion !== undefined) ||
    (command.operation === "RESTORE_LEGACY") !==
      (command.legacyRevisionId !== undefined) ||
    ((command.operation === "RESTORE" ||
      command.operation === "RESTORE_LEGACY") &&
      (Object.keys(command.edit.patch).length > 0 ||
        command.edit.publicationIntent))
  ) {
    throw new WorkingAggregateConflictError("RESTORE_COMMAND_CONFLICT");
  }

  if (
    command.operation === "RESET" &&
    (Object.keys(command.edit.patch).length > 0 ||
      command.edit.publicationIntent)
  ) {
    throw new WorkingAggregateConflictError("RESET_COMMAND_CONFLICT");
  }

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
        if (lifecycle) {
          await lockPublicationActor(tx, actor);
        }

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

        let aggregate =
          command.operation === "RESET"
            ? captureWorkingAggregate(source)
            : edited;

        if (command.operation === "RESET" && current.aggregate.release) {
          aggregate = { ...aggregate, release: current.aggregate.release };
        }

        if (lifecycle && current.version === 0) {
          throw new WorkingAggregateConflictError(
            "PUBLICATION_COMMAND_CONFLICT",
          );
        }

        if (command.operation === "SCHEDULE") {
          PublicationFieldsSchema.parse(aggregate.snapshot.fields);

          if (
            Date.parse(command.scheduledFor ?? "") <= Date.now() ||
            !actor.role ||
            actor.role === "SUBSCRIBER"
          ) {
            throw new WorkingAggregateConflictError(
              "PUBLICATION_COMMAND_CONFLICT",
            );
          }

          aggregate = {
            ...aggregate,
            release: {
              id: command.requestId,
              pinnedVersion: current.version,
              actorId: actor.id,
              actorRole: actor.role,
              scheduledFor: new Date(command.scheduledFor ?? "").toISOString(),
              state: "PENDING",
            },
          };
        }

        if (command.operation === "CANCEL_SCHEDULE") {
          if (aggregate.release?.state !== "PENDING") {
            throw new WorkingAggregateConflictError("SCHEDULE_CONFLICT");
          }

          aggregate = {
            ...aggregate,
            release: { ...aggregate.release, state: "CANCELLED" },
          };
        }

        if (command.operation === "EXECUTE") {
          const release = aggregate.release;

          if (
            !release ||
            release.state !== "PENDING" ||
            release.actorId !== actor.id ||
            release.actorRole !== actor.role ||
            Date.parse(release.scheduledFor) > Date.now()
          ) {
            throw new WorkingAggregateConflictError("SCHEDULE_CONFLICT");
          }

          const pinned = await tx.nPWorkingRevision.findUnique({
            where: {
              pageId_version: {
                pageId: command.pageId,
                version: release.pinnedVersion,
              },
            },
          });

          if (!pinned) {
            throw new WorkingAggregateConflictError("SCHEDULE_CONFLICT");
          }

          const accepted = WorkingAggregateSchema.parse(pinned.aggregate);
          assertWorkingAggregateBase(accepted, source);
          aggregate = { ...accepted, release };
        }

        if (command.operation === "RESTORE") {
          const historical = await tx.nPWorkingRevision.findUnique({
            where: {
              pageId_version: {
                pageId: command.pageId,
                version: command.restoreVersion ?? 0,
              },
            },
            select: { aggregate: true },
          });

          if (!historical) {
            throw new ContentNotFoundError();
          }

          const restored = WorkingAggregateSchema.parse(historical.aggregate);

          if (
            restored.pageId !== source.id ||
            restored.kind !== source.type ||
            restored.ownerId !== source.authorId
          ) {
            throw new WorkingAggregateConflictError("IDENTITY_CONFLICT");
          }

          // Restore content only. Historical base tokens and publication intent
          // must never replace the currently authorized baseline.
          aggregate = WorkingAggregateSchema.parse({
            ...aggregate,
            snapshot: restored.snapshot,
            rawPageDocument: restored.rawPageDocument,
            publicationIntent: { action: "PRESERVE" },
          });
        }

        if (command.operation === "RESTORE_LEGACY") {
          const historical = await tx.pageRevision.findFirst({
            where: { id: command.legacyRevisionId, pageId: command.pageId },
          });

          if (!historical) {
            throw new ContentNotFoundError();
          }

          aggregate = restoreLegacyWorkingAggregate(aggregate, historical);
        }

        const revisionId = randomUUID();
        let { edges } = mapEditorialReferenceEdges(
          revisionId,
          aggregate.snapshot,
        );

        const previousDocument = current.aggregate.snapshot.fields.pageDocument;
        const retainedDocuments = new Set(
          previousDocument ? pageDocumentIds(previousDocument) : [],
        );
        const restrictNewDocuments =
          actor.role === "AUTHOR" && command.operation === undefined;

        // Stable table/id order. Retained foreign keys also protect references after commit.
        for (const id of [
          ...new Set(edges.media.map((edge) => edge.mediaId)),
        ].sort()) {
          const found = await tx.$queryRaw<
            { mime: string; uploadedById: string | null }[]
          >`SELECT mime, "uploadedById" FROM "Media" WHERE id = ${id} FOR KEY SHARE NOWAIT`;
          const asset = found[0];

          if (
            !asset ||
            (restrictNewDocuments &&
              asset.mime === documentMime &&
              asset.uploadedById !== actor.id &&
              !retainedDocuments.has(id)) ||
            edges.media.some(
              (edge) =>
                edge.mediaId === id &&
                edge.path.endsWith(".documentId") !==
                  (asset.mime === documentMime),
            )
          ) {
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
                (edge.usage === "LISTING"
                  ? aggregate.snapshot.fields.layout === pageLayouts.posts &&
                    found[0]?.type !== "TAG"
                  : edge.usage !== found[0]?.type),
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

        let acceptedSourceVersion = sourceVersion;

        if (
          command.operation === "PUBLISH" ||
          command.operation === "UNPUBLISH" ||
          command.operation === "EXECUTE"
        ) {
          // Only fields editable/restorable by this contract are assigned. Historical
          // specialized fields, categories, gallery and operational counters stay intact.
          const fields = aggregate.snapshot.fields;
          const unpublish = command.operation === "UNPUBLISH";

          if (!unpublish) {
            // Validate the actual projection after capture, restore or pinned selection.
            PublicationFieldsSchema.parse(fields);
          }

          let publishedAt = source.publishedAt;

          if (
            !unpublish &&
            (source.status !== "PUBLISHED" ||
              !publishedAt ||
              publishedAt > new Date())
          ) {
            publishedAt = new Date();
          }

          const updated = await tx.page.update({
            where: { id: source.id },
            data: {
              ...(unpublish
                ? {}
                : {
                    title: fields.title,
                    slug: fields.slug,
                    content: fields.content,
                    excerpt: fields.excerpt,
                    layout: fields.layout,
                    ...(fields.layout === pageLayouts.posts
                      ? { listingTaxonomyId: fields.listingTaxonomyId }
                      : {}),
                    pageDocument: aggregate.rawPageDocument,
                    inHeaderMenu: fields.inHeaderMenu,
                    inFooterMenu: fields.inFooterMenu,
                  }),
              status: unpublish ? "DRAFT" : "PUBLISHED",
              publishedAt,
              workingVersion: { increment: 1 },
            },
          });

          if (!unpublish) {
            const tagIds = aggregate.snapshot.relationships.tagIds;
            await tx.pageOnTaxonomy.deleteMany({
              where: { pageId: source.id, taxonomy: { type: "TAG" } },
            });
            await tx.pageOnTaxonomy.createMany({
              data: tagIds.map((taxonomyId) => ({
                pageId: source.id,
                taxonomyId,
              })),
            });
          }

          await tx.pageRevision.create({
            data: {
              pageId: source.id,
              authorId: actor.id,
              title: updated.title,
              slug: updated.slug,
              excerpt: updated.excerpt,
              content: updated.content,
              layout: updated.layout,
              pageDocument: updated.pageDocument,
              workingVersion: updated.workingVersion,
              status: updated.status,
              publishedAt: updated.publishedAt,
              note: command.operation,
            },
          });
          const finalSource = await tx.page.findUniqueOrThrow({
            where: { id: source.id },
            include: {
              taxonomies: { include: { taxonomy: true } },
              gallery: true,
            },
          });

          const fence = await tx.nPContentFence.findUniqueOrThrow({
            where: { pageId: source.id },
          });
          acceptedSourceVersion = fence.version;
          const baseline = captureWorkingAggregate(finalSource);
          let release = aggregate.release;

          if (release?.state === "PENDING") {
            release = {
              ...release,
              state: command.operation === "EXECUTE" ? "EXECUTED" : "CANCELLED",
            };
          }

          aggregate = {
            ...baseline,
            ...(unpublish || command.operation === "EXECUTE"
              ? {
                  snapshot: current.aggregate.snapshot,
                  rawPageDocument: current.aggregate.rawPageDocument,
                }
              : {}),
            ...(release ? { release } : {}),
          };
        }

        if (lifecycle) {
          aggregate = WorkingAggregateSchema.parse({
            ...aggregate,
            receipt: {
              operation: command.operation,
              requestId: command.requestId,
              actorId: actor.id,
              pinnedVersion:
                command.operation === "EXECUTE"
                  ? current.aggregate.release?.pinnedVersion
                  : current.version,
              acceptedAt: new Date().toISOString(),
              ...(command.operation === "SCHEDULE" &&
              current.aggregate.release?.state === "PENDING"
                ? { supersededReleaseId: current.aggregate.release.id }
                : {}),
            },
          });
        }

        const version = current.version + 1;
        // Execution may retain a newer private snapshot while publishing its pin.
        // Its existing immutable references remain retained; index the final snapshot.
        ({ edges } = mapEditorialReferenceEdges(
          revisionId,
          aggregate.snapshot,
        ));
        aggregate = { ...aggregate, savedAt: new Date().toISOString() };
        await tx.$executeRaw`INSERT INTO "NPWorkingRevision"
      (id, "pageId", version, "sourceVersion", "requestId", "requestHash", aggregate)
      VALUES (${revisionId}::uuid, ${command.pageId}, ${version}, ${acceptedSourceVersion},
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

        return { version, sourceVersion: acceptedSourceVersion, aggregate };
      },
      { isolationLevel: "ReadCommitted", timeout: 15000 },
    )
    .catch(persistenceFailure);
}
