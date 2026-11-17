BEGIN;
-- CreateTable
CREATE TABLE "NPContentFence" (
    "pageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NPContentFence_pkey" PRIMARY KEY ("pageId")
);

-- CreateTable
CREATE TABLE "NPWorkingRevision" (
    "id" UUID NOT NULL,
    "pageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "requestId" UUID NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "aggregate" JSONB NOT NULL,

    CONSTRAINT "NPWorkingRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NPWorkingMedia" (
    "revisionId" UUID NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "NPWorkingMedia_pkey" PRIMARY KEY ("revisionId","targetId")
);

-- CreateTable
CREATE TABLE "NPWorkingTaxonomy" (
    "revisionId" UUID NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "NPWorkingTaxonomy_pkey" PRIMARY KEY ("revisionId","targetId")
);

-- CreateTable
CREATE TABLE "NPWorkingPage" (
    "revisionId" UUID NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "NPWorkingPage_pkey" PRIMARY KEY ("revisionId","targetId")
);

-- CreateIndex
CREATE UNIQUE INDEX "NPWorkingRevision_pageId_version_key" ON "NPWorkingRevision"("pageId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "NPWorkingRevision_pageId_requestId_key" ON "NPWorkingRevision"("pageId", "requestId");

-- CreateIndex
CREATE INDEX "NPWorkingMedia_targetId_idx" ON "NPWorkingMedia"("targetId");

-- CreateIndex
CREATE INDEX "NPWorkingTaxonomy_targetId_idx" ON "NPWorkingTaxonomy"("targetId");

-- CreateIndex
CREATE INDEX "NPWorkingPage_targetId_idx" ON "NPWorkingPage"("targetId");

-- AddForeignKey
ALTER TABLE "NPWorkingRevision" ADD CONSTRAINT "NPWorkingRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "NPWorkingMedia" ADD CONSTRAINT "NPWorkingMedia_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "NPWorkingRevision"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "NPWorkingMedia" ADD CONSTRAINT "NPWorkingMedia_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "NPWorkingTaxonomy" ADD CONSTRAINT "NPWorkingTaxonomy_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "NPWorkingRevision"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "NPWorkingTaxonomy" ADD CONSTRAINT "NPWorkingTaxonomy_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Taxonomy"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "NPWorkingPage" ADD CONSTRAINT "NPWorkingPage_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "NPWorkingRevision"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "NPWorkingPage" ADD CONSTRAINT "NPWorkingPage_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "NPContentFence" ADD CHECK (version >= 0);
ALTER TABLE "NPWorkingRevision" ADD CHECK (version > 0 AND "sourceVersion" >= 0);
INSERT INTO "NPContentFence" ("pageId") SELECT id FROM "Page";

-- Every legacy content/relationship writer, including old clients and FK cascades,
-- must own the same per-content fence. NOWAIT prevents inversions with implicit
-- legacy row locks; a contender aborts its entire transaction instead of deadlocking.
CREATE FUNCTION public.fence_private_working_source() RETURNS trigger
LANGUAGE plpgsql AS $body$
DECLARE targets text[]; target text;
BEGIN
  IF TG_TABLE_NAME = 'Page' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO "NPContentFence" ("pageId") VALUES (NEW.id);
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF NEW.id <> OLD.id THEN
        RAISE EXCEPTION USING ERRCODE = 'P5504', MESSAGE = 'CONTENT_IDENTITY_IMMUTABLE';
      END IF;
      IF (to_jsonb(NEW) - ARRAY['viewCount','uniqueViewCount','likeCount','lastViewedAt','updatedAt']) =
         (to_jsonb(OLD) - ARRAY['viewCount','uniqueViewCount','likeCount','lastViewedAt','updatedAt']) THEN
        RETURN NEW;
      END IF;
    END IF;
    targets := ARRAY[OLD.id];
  ELSE
    IF TG_OP = 'INSERT' THEN targets := ARRAY[NEW."pageId"];
    ELSIF TG_OP = 'DELETE' THEN targets := ARRAY[OLD."pageId"];
    ELSE targets := ARRAY[OLD."pageId", NEW."pageId"];
    END IF;
  END IF;
  FOR target IN SELECT DISTINCT unnest(targets) ORDER BY 1 LOOP
    PERFORM 1 FROM "NPContentFence" WHERE "pageId" = target FOR UPDATE NOWAIT;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P5504', MESSAGE = 'CONTENT_FENCE_UNAVAILABLE';
    END IF;
    UPDATE "NPContentFence" SET version = version + 1 WHERE "pageId" = target;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$body$;

CREATE TRIGGER private_source_insert AFTER INSERT ON "Page"
FOR EACH ROW EXECUTE FUNCTION public.fence_private_working_source();
ALTER TABLE "Page" ENABLE ALWAYS TRIGGER private_source_insert;
CREATE TRIGGER private_source_mutation BEFORE UPDATE OR DELETE ON "Page"
FOR EACH ROW EXECUTE FUNCTION public.fence_private_working_source();
ALTER TABLE "Page" ENABLE ALWAYS TRIGGER private_source_mutation;
DO $install$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['PageRevision','PageOnTaxonomy','PageMedia'] LOOP
    EXECUTE format('CREATE TRIGGER private_source_mutation BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION public.fence_private_working_source()', target);
    EXECUTE format('ALTER TABLE %I ENABLE ALWAYS TRIGGER private_source_mutation', target);
  END LOOP;
END
$install$;

-- Application credentials cannot rewrite history, references, request replay or
-- fence tombstones. Administrative schema changes remain an operator responsibility.
CREATE FUNCTION public.reject_private_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $body$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P5505', MESSAGE = 'PRIVATE_HISTORY_IMMUTABLE';
END
$body$;
DO $install$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['NPWorkingRevision','NPWorkingMedia','NPWorkingTaxonomy','NPWorkingPage'] LOOP
    EXECUTE format('CREATE TRIGGER private_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION public.reject_private_history_mutation()', target);
    EXECUTE format('ALTER TABLE %I ENABLE ALWAYS TRIGGER private_history_immutable', target);
    -- Apply the unchanged maintenance/READY gate before private writes too.
    EXECUTE format('CREATE TRIGGER private_maintenance_guard BEFORE INSERT ON %I FOR EACH STATEMENT EXECUTE FUNCTION public.guard_legacy_backfill_mutation()', target);
    EXECUTE format('ALTER TABLE %I ENABLE ALWAYS TRIGGER private_maintenance_guard', target);
  END LOOP;
END
$install$;

CREATE FUNCTION public.protect_private_taxonomy_type() RETURNS trigger
LANGUAGE plpgsql AS $body$
DECLARE target text;
BEGIN
  IF NEW.type <> OLD.type THEN
    IF EXISTS (SELECT 1 FROM "NPWorkingTaxonomy" WHERE "targetId" = OLD.id) THEN
      RAISE EXCEPTION USING ERRCODE = 'P5505', MESSAGE = 'PRIVATE_REFERENCE_TYPE_RETAINED';
    END IF;
    -- Classification participates in captured tag/category relationships even
    -- when a private patch removes that target, so fence all linked sources.
    FOR target IN SELECT "pageId" FROM "PageOnTaxonomy" WHERE "taxonomyId" = OLD.id ORDER BY "pageId" LOOP
      PERFORM 1 FROM "NPContentFence" WHERE "pageId" = target FOR UPDATE NOWAIT;
      UPDATE "NPContentFence" SET version = version + 1 WHERE "pageId" = target;
    END LOOP;
  END IF;
  RETURN NEW;
END
$body$;
CREATE TRIGGER private_taxonomy_type BEFORE UPDATE OF type ON "Taxonomy"
FOR EACH ROW EXECUTE FUNCTION public.protect_private_taxonomy_type();
ALTER TABLE "Taxonomy" ENABLE ALWAYS TRIGGER private_taxonomy_type;
-- TRUNCATE cannot participate in row fencing; reject it rather than silently
-- bypassing the protocol. Maintenance exports/expand-only migrations do not need it.
DO $install$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['Page','PageRevision','PageOnTaxonomy','PageMedia'] LOOP
    EXECUTE format('CREATE TRIGGER private_source_no_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION public.reject_private_history_mutation()', target);
    EXECUTE format('ALTER TABLE %I ENABLE ALWAYS TRIGGER private_source_no_truncate', target);
  END LOOP;
END
$install$;
CREATE TRIGGER private_fence_retained BEFORE DELETE OR TRUNCATE ON "NPContentFence"
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_private_history_mutation();
ALTER TABLE "NPContentFence" ENABLE ALWAYS TRIGGER private_fence_retained;
COMMIT;

