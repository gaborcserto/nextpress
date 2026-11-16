BEGIN;

-- One global mutation domain deliberately covers unversioned joins and old clients.
CREATE TABLE "LegacyBackfillFence" (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  generation BIGSERIAL NOT NULL,
  owner UUID,
  "expiresAt" TIMESTAMPTZ(3),
  CHECK ((owner IS NULL) = ("expiresAt" IS NULL)),
  CHECK (generation > 0)
);
INSERT INTO "LegacyBackfillFence" (id) VALUES (1);

CREATE FUNCTION public.guard_legacy_backfill_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(71520260503::bigint);
  PERFORM 1 FROM public."LegacyBackfillFence" WHERE id = 1 FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P5502', MESSAGE = 'BACKFILL_COORDINATION_UNAVAILABLE';
  END IF;
  IF EXISTS (SELECT 1 FROM public."LegacyBackfillFence" WHERE id = 1 AND owner IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P5501', MESSAGE = 'BACKFILL_WRITER_HELD';
  END IF;
  RETURN NULL;
END
$guard$;

DO $install$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['Page','PageRevision','PageOnTaxonomy','PageMedia','Media','Taxonomy','User'] LOOP
    EXECUTE format('CREATE TRIGGER legacy_backfill_guard BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.guard_legacy_backfill_mutation()', target);
    EXECUTE format('ALTER TABLE public.%I ENABLE ALWAYS TRIGGER legacy_backfill_guard', target);
  END LOOP;
END
$install$;
COMMIT;
