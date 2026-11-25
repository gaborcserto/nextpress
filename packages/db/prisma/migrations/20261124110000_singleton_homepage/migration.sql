DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Page"
    WHERE "type" = 'PAGE' AND "layout" = 'HOME'
    GROUP BY "type", "layout"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce a singleton Homepage: multiple PAGE records use layout HOME. Resolve the conflicting records explicitly before retrying this migration.';
  END IF;
END $$;

DROP INDEX IF EXISTS "Page_published_home_key";

CREATE UNIQUE INDEX "Page_homepage_singleton_key"
ON "Page" ("type", "layout")
WHERE "type" = 'PAGE' AND "layout" = 'HOME';
