BEGIN;
SET LOCAL lock_timeout='3s';
-- CreateTable
CREATE TABLE "ContentEditorialState" (
    "pageId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "nextRevisionNumber" INTEGER NOT NULL,
    "visibility" TEXT NOT NULL,
    "liveRevisionId" TEXT,
    "initialRevisionId" TEXT,
    "lastPublishedAt" TIMESTAMPTZ(3),
    "enrollmentState" TEXT NOT NULL,
    "enrollmentEpoch" INTEGER NOT NULL,
    "enrolledAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContentEditorialState_pkey" PRIMARY KEY ("pageId")
);

-- CreateTable
CREATE TABLE "ContentDraft" (
    "pageId" TEXT NOT NULL,
    "draftVersion" INTEGER NOT NULL,
    "baseContentVersion" INTEGER NOT NULL,
    "revisionId" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("pageId")
);

-- CreateTable
CREATE TABLE "ContentRevision" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "aggregate" JSONB,
    "rawSource" TEXT,
    "coverage" JSONB NOT NULL,
    "aggregateHash" CHAR(64) NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "sourceRevisionId" TEXT,
    "baseRevisionId" TEXT,
    "provenance" JSONB,
    "reason" TEXT NOT NULL,

    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPublication" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revisionId" TEXT,
    "generation" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "committedAt" TIMESTAMPTZ(3) NOT NULL,
    "effectiveAt" TIMESTAMPTZ(3),
    "displayedPublishedAt" TIMESTAMPTZ(3),
    "operationId" UUID NOT NULL,
    "enrollmentEpoch" INTEGER NOT NULL,

    CONSTRAINT "ContentPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentScheduledRelease" (
    "pageId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "scheduledFor" TIMESTAMPTZ(3) NOT NULL,
    "displayTimezone" TEXT,
    "scheduledById" TEXT,
    "previousLiveRevisionId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContentScheduledRelease_pkey" PRIMARY KEY ("pageId")
);

-- CreateTable
CREATE TABLE "ContentSlugReservation" (
    "normalizedSlug" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "releaseGeneration" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContentSlugReservation_pkey" PRIMARY KEY ("normalizedSlug")
);

-- CreateTable
CREATE TABLE "ContentRevisionMedia" (
    "revisionId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "usage" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "path" TEXT NOT NULL,

    CONSTRAINT "ContentRevisionMedia_pkey" PRIMARY KEY ("revisionId","usage","path","position")
);

-- CreateTable
CREATE TABLE "ContentRevisionTaxonomy" (
    "revisionId" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,
    "usage" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ContentRevisionTaxonomy_pkey" PRIMARY KEY ("revisionId","usage","position")
);

-- CreateTable
CREATE TABLE "ContentRevisionPageReference" (
    "revisionId" TEXT NOT NULL,
    "targetPageId" TEXT NOT NULL,
    "usage" TEXT NOT NULL,
    "path" TEXT NOT NULL,

    CONSTRAINT "ContentRevisionPageReference_pkey" PRIMARY KEY ("revisionId","usage","path")
);

-- CreateTable
CREATE TABLE "ContentLegacyRevisionImport" (
    "legacyRevisionId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "sourceHash" CHAR(64) NOT NULL,
    "adapterVersion" INTEGER NOT NULL,
    "importedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContentLegacyRevisionImport_pkey" PRIMARY KEY ("legacyRevisionId")
);

-- CreateTable
CREATE TABLE "ContentMigrationCheckpoint" (
    "pageId" TEXT NOT NULL,
    "adapterVersion" INTEGER NOT NULL,
    "sourceFingerprint" CHAR(64) NOT NULL,
    "projectionHash" CHAR(64) NOT NULL,
    "baselineRevisionId" TEXT,
    "status" TEXT NOT NULL,
    "capturedWorkingVersion" INTEGER NOT NULL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3),
    "failureCode" TEXT,

    CONSTRAINT "ContentMigrationCheckpoint_pkey" PRIMARY KEY ("pageId")
);

-- CreateTable
CREATE TABLE "EditorialOperation" (
    "actorKey" TEXT NOT NULL,
    "operationId" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "pageId" TEXT,
    "requestHash" CHAR(64) NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "replayUntil" TIMESTAMPTZ(3),
    "expiredAt" TIMESTAMPTZ(3),

    CONSTRAINT "EditorialOperation_pkey" PRIMARY KEY ("actorKey","operation","operationId")
);

-- CreateTable
CREATE TABLE "ContentEditLease" (
    "pageId" TEXT NOT NULL,
    "generation" BIGINT NOT NULL,
    "editorId" TEXT,
    "sessionBindingHash" CHAR(64),
    "editorInstanceId" UUID,
    "tokenHash" CHAR(64),
    "acquiredAt" TIMESTAMPTZ(3),
    "renewedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "ContentEditLease_pkey" PRIMARY KEY ("pageId")
);

-- CreateTable
CREATE TABLE "ContentEditLeaseEvent" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "generation" BIGINT NOT NULL,
    "previousGeneration" BIGINT,
    "action" TEXT NOT NULL,
    "actorKey" TEXT,
    "previousEditorKey" TEXT,
    "editorInstanceId" UUID,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "operationId" UUID NOT NULL,
    "reasonCode" TEXT,

    CONSTRAINT "ContentEditLeaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentEditorialState_enrollmentState_pageId_idx" ON "ContentEditorialState"("enrollmentState", "pageId");

-- CreateIndex
CREATE INDEX "ContentRevision_pageId_number_id_idx" ON "ContentRevision"("pageId", "number" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ContentRevision_pageId_sourceRevisionId_idx" ON "ContentRevision"("pageId", "sourceRevisionId");

-- CreateIndex
CREATE INDEX "ContentRevision_pageId_baseRevisionId_idx" ON "ContentRevision"("pageId", "baseRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentRevision_pageId_id_key" ON "ContentRevision"("pageId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ContentRevision_pageId_number_key" ON "ContentRevision"("pageId", "number");

-- CreateIndex
CREATE INDEX "ContentPublication_pageId_committedAt_id_idx" ON "ContentPublication"("pageId", "committedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPublication_pageId_generation_key" ON "ContentPublication"("pageId", "generation");

-- CreateIndex
CREATE INDEX "ContentScheduledRelease_scheduledFor_pageId_idx" ON "ContentScheduledRelease"("scheduledFor", "pageId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentSlugReservation_pageId_releaseGeneration_key" ON "ContentSlugReservation"("pageId", "releaseGeneration");

-- CreateIndex
CREATE INDEX "ContentRevisionMedia_mediaId_revisionId_idx" ON "ContentRevisionMedia"("mediaId", "revisionId");

-- CreateIndex
CREATE INDEX "ContentRevisionTaxonomy_taxonomyId_revisionId_idx" ON "ContentRevisionTaxonomy"("taxonomyId", "revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentRevisionTaxonomy_revisionId_usage_taxonomyId_key" ON "ContentRevisionTaxonomy"("revisionId", "usage", "taxonomyId");

-- CreateIndex
CREATE INDEX "ContentRevisionPageReference_targetPageId_revisionId_idx" ON "ContentRevisionPageReference"("targetPageId", "revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentLegacyRevisionImport_revisionId_key" ON "ContentLegacyRevisionImport"("revisionId");

-- CreateIndex
CREATE INDEX "ContentLegacyRevisionImport_pageId_idx" ON "ContentLegacyRevisionImport"("pageId");

-- CreateIndex
CREATE INDEX "ContentMigrationCheckpoint_status_pageId_idx" ON "ContentMigrationCheckpoint"("status", "pageId");

-- CreateIndex
CREATE INDEX "EditorialOperation_pageId_createdAt_idx" ON "EditorialOperation"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "EditorialOperation_replayUntil_idx" ON "EditorialOperation"("replayUntil");

-- CreateIndex
CREATE INDEX "ContentEditLease_expiresAt_idx" ON "ContentEditLease"("expiresAt");

-- CreateIndex
CREATE INDEX "ContentEditLease_editorId_idx" ON "ContentEditLease"("editorId");

-- CreateIndex
CREATE INDEX "ContentEditLeaseEvent_pageId_occurredAt_id_idx" ON "ContentEditLeaseEvent"("pageId", "occurredAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ContentEditLeaseEvent_pageId_generation_key" ON "ContentEditLeaseEvent"("pageId", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "ContentEditLeaseEvent_actorKey_operationId_key" ON "ContentEditLeaseEvent"("actorKey", "operationId");

-- AddForeignKey
ALTER TABLE "ContentEditorialState" ADD CONSTRAINT "ContentEditorialState_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentEditorialState" ADD CONSTRAINT "ContentEditorialState_pageId_liveRevisionId_fkey" FOREIGN KEY ("pageId", "liveRevisionId") REFERENCES "ContentRevision"("pageId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentEditorialState" ADD CONSTRAINT "ContentEditorialState_pageId_initialRevisionId_fkey" FOREIGN KEY ("pageId", "initialRevisionId") REFERENCES "ContentRevision"("pageId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ContentEditorialState"("pageId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_pageId_revisionId_fkey" FOREIGN KEY ("pageId", "revisionId") REFERENCES "ContentRevision"("pageId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_pageId_sourceRevisionId_fkey" FOREIGN KEY ("pageId", "sourceRevisionId") REFERENCES "ContentRevision"("pageId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_pageId_baseRevisionId_fkey" FOREIGN KEY ("pageId", "baseRevisionId") REFERENCES "ContentRevision"("pageId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentPublication" ADD CONSTRAINT "ContentPublication_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ContentEditorialState"("pageId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentPublication" ADD CONSTRAINT "ContentPublication_pageId_revisionId_fkey" FOREIGN KEY ("pageId", "revisionId") REFERENCES "ContentRevision"("pageId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentPublication" ADD CONSTRAINT "ContentPublication_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentScheduledRelease" ADD CONSTRAINT "ContentScheduledRelease_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ContentEditorialState"("pageId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentScheduledRelease" ADD CONSTRAINT "ContentScheduledRelease_pageId_revisionId_fkey" FOREIGN KEY ("pageId", "revisionId") REFERENCES "ContentRevision"("pageId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentScheduledRelease" ADD CONSTRAINT "ContentScheduledRelease_pageId_previousLiveRevisionId_fkey" FOREIGN KEY ("pageId", "previousLiveRevisionId") REFERENCES "ContentRevision"("pageId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentScheduledRelease" ADD CONSTRAINT "ContentScheduledRelease_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentScheduledRelease" ADD CONSTRAINT "ContentScheduledRelease_pageId_generation_fkey" FOREIGN KEY ("pageId", "generation") REFERENCES "ContentPublication"("pageId", "generation") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentSlugReservation" ADD CONSTRAINT "ContentSlugReservation_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ContentEditorialState"("pageId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentSlugReservation" ADD CONSTRAINT "ContentSlugReservation_pageId_releaseGeneration_fkey" FOREIGN KEY ("pageId", "releaseGeneration") REFERENCES "ContentPublication"("pageId", "generation") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentRevisionMedia" ADD CONSTRAINT "ContentRevisionMedia_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ContentRevision"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentRevisionMedia" ADD CONSTRAINT "ContentRevisionMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentRevisionTaxonomy" ADD CONSTRAINT "ContentRevisionTaxonomy_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ContentRevision"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentRevisionTaxonomy" ADD CONSTRAINT "ContentRevisionTaxonomy_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "Taxonomy"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentRevisionPageReference" ADD CONSTRAINT "ContentRevisionPageReference_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ContentRevision"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentRevisionPageReference" ADD CONSTRAINT "ContentRevisionPageReference_targetPageId_fkey" FOREIGN KEY ("targetPageId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentLegacyRevisionImport" ADD CONSTRAINT "ContentLegacyRevisionImport_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentLegacyRevisionImport" ADD CONSTRAINT "ContentLegacyRevisionImport_pageId_revisionId_fkey" FOREIGN KEY ("pageId", "revisionId") REFERENCES "ContentRevision"("pageId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentLegacyRevisionImport" ADD CONSTRAINT "ContentLegacyRevisionImport_legacyRevisionId_fkey" FOREIGN KEY ("legacyRevisionId") REFERENCES "PageRevision"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentMigrationCheckpoint" ADD CONSTRAINT "ContentMigrationCheckpoint_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentMigrationCheckpoint" ADD CONSTRAINT "ContentMigrationCheckpoint_pageId_baselineRevisionId_fkey" FOREIGN KEY ("pageId", "baselineRevisionId") REFERENCES "ContentRevision"("pageId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentEditLease" ADD CONSTRAINT "ContentEditLease_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContentEditLease" ADD CONSTRAINT "ContentEditLease_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "ContentEditorialState" ADD CONSTRAINT "ContentEditorialState_contentVersion_range" CHECK ("contentVersion" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentEditorialState" ADD CONSTRAINT "ContentEditorialState_nextRevisionNumber_range" CHECK ("nextRevisionNumber" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentEditorialState" ADD CONSTRAINT "ContentEditorialState_enrollmentEpoch_range" CHECK ("enrollmentEpoch" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_draftVersion_range" CHECK ("draftVersion" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_baseContentVersion_range" CHECK ("baseContentVersion" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_number_range" CHECK ("number" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_schemaVersion_range" CHECK ("schemaVersion" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentPublication" ADD CONSTRAINT "ContentPublication_generation_range" CHECK ("generation" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentPublication" ADD CONSTRAINT "ContentPublication_enrollmentEpoch_range" CHECK ("enrollmentEpoch" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentScheduledRelease" ADD CONSTRAINT "ContentScheduledRelease_generation_range" CHECK ("generation" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentSlugReservation" ADD CONSTRAINT "ContentSlugReservation_releaseGeneration_range" CHECK ("releaseGeneration" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentMigrationCheckpoint" ADD CONSTRAINT "ContentMigrationCheckpoint_adapterVersion_range" CHECK ("adapterVersion" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentMigrationCheckpoint" ADD CONSTRAINT "ContentMigrationCheckpoint_capturedWorkingVersion_range" CHECK ("capturedWorkingVersion" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentLegacyRevisionImport" ADD CONSTRAINT "ContentLegacyRevisionImport_adapterVersion_range" CHECK ("adapterVersion" BETWEEN 0 AND 2147483646);
ALTER TABLE "ContentEditorialState" ADD CONSTRAINT "ContentEditorialState_visibility_values" CHECK ("visibility" IN ('PRIVATE','PUBLIC'));
ALTER TABLE "ContentEditorialState" ADD CONSTRAINT "ContentEditorialState_enrollmentState_values" CHECK ("enrollmentState" IN ('SHADOW','READY','ENROLLED','BLOCKED'));
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_reason_values" CHECK ("reason" IN ('CREATE','SAVE','RESTORE','DISCARD','LEGACY_IMPORT'));
ALTER TABLE "ContentPublication" ADD CONSTRAINT "ContentPublication_action_values" CHECK ("action" IN ('PUBLISH','UNPUBLISH','SCHEDULE','CANCEL_SCHEDULE'));
ALTER TABLE "ContentMigrationCheckpoint" ADD CONSTRAINT "ContentMigrationCheckpoint_status_values" CHECK ("status" IN ('CAPTURED','VERIFIED','NEEDS_RECONCILIATION','FAILED'));
ALTER TABLE "ContentRevisionMedia" ADD CONSTRAINT "ContentRevisionMedia_usage_values" CHECK ("usage" IN ('COVER','GALLERY','DOCUMENT'));
ALTER TABLE "ContentRevisionTaxonomy" ADD CONSTRAINT "ContentRevisionTaxonomy_usage_values" CHECK ("usage" IN ('TAG','CATEGORY','LISTING'));
ALTER TABLE "ContentRevisionPageReference" ADD CONSTRAINT "ContentRevisionPageReference_usage_values" CHECK ("usage" IN ('PARENT'));
ALTER TABLE "ContentEditLeaseEvent" ADD CONSTRAINT "ContentEditLeaseEvent_action_values" CHECK ("action" IN ('ACQUIRE','RELEASE','EXPIRE','TAKEOVER','REVOKE','CONTENT_DELETE','RECOVERY_INVALIDATE'));
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_aggregateHash_hash" CHECK ("aggregateHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ContentLegacyRevisionImport" ADD CONSTRAINT "ContentLegacyRevisionImport_sourceHash_hash" CHECK ("sourceHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ContentMigrationCheckpoint" ADD CONSTRAINT "ContentMigrationCheckpoint_sourceFingerprint_hash" CHECK ("sourceFingerprint" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ContentMigrationCheckpoint" ADD CONSTRAINT "ContentMigrationCheckpoint_projectionHash_hash" CHECK ("projectionHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "EditorialOperation" ADD CONSTRAINT "EditorialOperation_requestHash_hash" CHECK ("requestHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ContentEditLease" ADD CONSTRAINT "ContentEditLease_tokenHash_hash" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ContentEditLease" ADD CONSTRAINT "ContentEditLease_sessionBindingHash_hash" CHECK ("sessionBindingHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_source_shape" CHECK (("aggregate" IS NOT NULL AND "rawSource" IS NULL) OR ("aggregate" IS NULL AND "rawSource" IS NOT NULL));
ALTER TABLE "ContentPublication" ADD CONSTRAINT "ContentPublication_action_shape" CHECK (("action" IN ('PUBLISH','SCHEDULE') AND "revisionId" IS NOT NULL AND "effectiveAt" IS NOT NULL) OR ("action" IN ('UNPUBLISH','CANCEL_SCHEDULE') AND "revisionId" IS NULL));
ALTER TABLE "ContentRevisionMedia" ADD CONSTRAINT "ContentRevisionMedia_position_range" CHECK ("position" >= 0);
ALTER TABLE "ContentRevisionTaxonomy" ADD CONSTRAINT "ContentRevisionTaxonomy_position_range" CHECK ("position" >= 0);
ALTER TABLE "ContentEditLease" ADD CONSTRAINT "ContentEditLease_generation_range" CHECK ("generation" >= 0);
ALTER TABLE "ContentEditLease" ADD CONSTRAINT "ContentEditLease_slot_shape" CHECK (("editorId" IS NULL AND "tokenHash" IS NULL AND "sessionBindingHash" IS NULL AND "editorInstanceId" IS NULL AND "acquiredAt" IS NULL AND "renewedAt" IS NULL AND "expiresAt" IS NULL) OR ("generation" > 0 AND "tokenHash" IS NOT NULL AND "sessionBindingHash" IS NOT NULL AND "editorInstanceId" IS NOT NULL AND "acquiredAt" IS NOT NULL AND "renewedAt" IS NOT NULL AND "expiresAt" IS NOT NULL AND "acquiredAt" <= "renewedAt" AND "renewedAt" < "expiresAt" AND "expiresAt" <= "renewedAt" + interval '120 seconds'));
ALTER TABLE "ContentEditLeaseEvent" ADD CONSTRAINT "ContentEditLeaseEvent_generation_range" CHECK ("generation" > 0 AND ("previousGeneration" IS NULL OR ("previousGeneration" >= 0 AND "previousGeneration" < "generation")));
ALTER TABLE "ContentEditLeaseEvent" ADD CONSTRAINT "ContentEditLeaseEvent_actor_required" CHECK ("action" NOT IN ('ACQUIRE','RELEASE','TAKEOVER','REVOKE') OR "actorKey" IS NOT NULL);
ALTER TABLE "EditorialOperation" ADD CONSTRAINT "EditorialOperation_retention_shape" CHECK (("replayUntil" IS NULL OR "replayUntil" >= "createdAt") AND ("expiredAt" IS NULL OR ("expiredAt" >= "createdAt" AND "result" IS NULL)));

COMMIT;
