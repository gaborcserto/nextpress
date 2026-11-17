BEGIN;
-- Row locking normally requires UPDATE on User and Role. Expose only the
-- necessary locked read, never grant authentication-table mutation to publishers.
CREATE FUNCTION public.np_lock_publication_actor(actor_id text)
RETURNS TABLE(name text)
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog
AS $body$
  SELECT r.name FROM public."User" u
  JOIN public."Role" r ON r.id = u."roleId"
  WHERE u.id = actor_id FOR SHARE OF u, r NOWAIT
$body$;
REVOKE ALL ON FUNCTION public.np_lock_publication_actor(text) FROM PUBLIC;
COMMIT;
