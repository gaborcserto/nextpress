BEGIN;

-- Retain the existing global coordination domain during ownership preparation.
-- SHADOW is legacy-owned. READY seals the cohort; active runtime remains disabled.
CREATE OR REPLACE FUNCTION public.guard_legacy_backfill_mutation() RETURNS trigger
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
  IF EXISTS (SELECT 1 FROM public."ContentEditorialState" WHERE "enrollmentState" <> 'SHADOW') THEN
    RAISE EXCEPTION USING ERRCODE = 'P5503', MESSAGE = 'EDITORIAL_WRITER_OWNED';
  END IF;
  RETURN NULL;
END
$guard$;
COMMIT;
