# PostgreSQL persistence and migrations

The PostgreSQL 18 image stores its cluster under `/var/lib/postgresql/18/docker`.
Compose mounts an explicitly selected external volume at `/var/lib/postgresql`.
It requires `POSTGRES_VOLUME_NAME` so an existing installation cannot silently
switch to a different, empty volume. External volumes are managed separately from
the Compose service lifecycle.

For a new installation, copy the root `.env.example` to `.env`, then run
`docker volume create nextpress_pg` before `npm run db:up`. Keep the root `.env`
local; it selects the Docker volume and does not configure application database
credentials. For an existing installation, inspect and back up first, then set
`POSTGRES_VOLUME_NAME` to the volume that actually contains the cluster.

The inspected development image has `/var/lib/postgresql/data -> .`. Its legacy
`nextpress_pg:/var/lib/postgresql/data` mount therefore held the cluster at the
parent directory even though Docker also reported an anonymous parent volume.
Mount metadata and `SHOW data_directory` alone did not distinguish the volumes.
Read-only inspection confirmed `nextpress_pg` contains `18/docker/PG_VERSION`.
Do not generalize this layout to other images or installations.

## Existing installations

1. Inspect the existing container's mounts (`docker inspect`) and query `SHOW
   data_directory` through `psql`. Inspect named and anonymous volumes without
   modifying them, and inspect the image's symlinks. Use a helper container with
   each candidate volume mounted read-only at an unrelated path to locate
   `PG_VERSION`. A symlink can make the reported mount destination misleading.
   Either volume may contain the cluster; preserve both until this is established.
2. Create a logical backup using the running server's PostgreSQL 18 `pg_dump`
   (custom format), and capture roles with `pg_dumpall --globals-only`. Store these
   outside the container in private backup storage; role dumps can contain secrets.
3. Restore into a separately named, isolated PostgreSQL 18 container and fresh
   volume. Require a successful `pg_restore --exit-on-error`, then compare schema,
   representative record counts and application reads. Merely listing a dump's
   archive contents does not prove restorability.
4. Only after restore verification, plan a transition to a parent-directory mount
   using the verified volume name in the root `.env`.
   Never overwrite an existing cluster or delete either original volume. Keep the
   original container/volume mapping available for rollback.
5. Prove the corrected layout independently: create a uniquely named disposable
   volume mounted at `/var/lib/postgresql`, insert a marker record, remove only
   that test container, recreate it with the same volume, and query the marker.
   Do not use the project's container names, ports, or volumes for this test.

Never run `docker compose down -v` on existing project data. Starting Docker or
editing YAML alone does not establish that an existing cluster is safe to recreate.

## Migration commands

Use `npm run prisma:validate` to validate the schema and `npm run prisma:generate`
to generate the client. Use `npm run prisma:migrate` only for development migration
authoring. Deploy committed migrations with `npm run prisma:deploy`; it uses
`prisma migrate deploy` and is never cached by Turbo. Verify the target database
identity before running either migration command. Neither command seeds data.

CI deploys committed migrations to its own ephemeral PostgreSQL service. This
does not verify or back up an existing developer or production database.
