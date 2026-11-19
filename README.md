# NextPress

NextPress is a PostgreSQL-backed headless CMS with separate API, administration and public website applications. It manages pages and posts and delivers published content through an anonymous HTTP API.

## Features

- Page and post editing with rich content, taxonomy and legacy revision history.
- PNG/JPEG uploads, a media library and reference-aware deletion checks.
- Session authentication and server-side role and ownership checks through Better Auth.
- User administration, site settings, navigation and website appearance controls.
- A public blog template with classic, modern and minimal presets, search and tag archives.
- Canonical and Open Graph metadata, sitemap and robots routes.
- A development-only OpenAPI document and interactive API reference.

Private drafts, autosave and restoration are rehearsal-only. The guarded private draft rehearsal supports publishing, unpublishing and pinned scheduled release. Production admission remains disabled; no unattended scheduler is installed.

## Architecture

The npm workspace monorepo uses Turborepo to coordinate these applications and packages:

- [`apps/api`](apps/api/README.md): authoritative authentication, authorization, validation, content services and database access.
- [`apps/admin`](apps/admin/README.md): authenticated CMS interface; browser API calls are forwarded to the API on the same origin.
- [`apps/web`](apps/web/README.md): public website consuming `/api/public/*` through server-side HTTP requests, without database credentials.
- [`packages/db`](packages/db): Prisma schema, migrations, client and seed code.
- [`packages/shared`](packages/shared): shared validation contracts, content types and browser-safe schemas.
- [`packages/eslint-config`](packages/eslint-config): shared application lint rules.

The existing Page projection remains authoritative for public delivery. Public content must be published with a non-null publication time that is due. Private revisions are not public-reader inputs; web API requests currently use `no-store`.

## Tech stack

TypeScript, Next.js App Router, React, Better Auth, Prisma, PostgreSQL and Zod. The admin uses Slate, Tailwind CSS and daisyUI. Verification uses ESLint, Oxfmt, Vitest, React Testing Library and Playwright.

## Quick start

Use Node.js 24.x ([`.nvmrc`](.nvmrc)), npm 12.2.2 and Docker with Compose for local PostgreSQL 18. Run commands from the repository root. If you already have a NextPress database, follow [Start an existing installation](#start-an-existing-installation).

1. Clone and install:

   ```sh
   git clone https://github.com/gaborcserto/nextpress.git
   cd nextpress
   npm ci
   ```

2. On a fresh checkout, copy the templates below to `.env` in their respective directories (`cp` in Bash or `Copy-Item` in PowerShell). Keep existing files when returning to a checkout.

   - [Root, only when using Docker Compose](.env.example)
   - [API](apps/api/.env.example)
   - [Admin](apps/admin/.env.example)
   - [Web](apps/web/.env.example)
   - [Database package, only for the optional demo content seed](packages/db/.env.example)

   In `apps/api/.env`, set a unique `BETTER_AUTH_SECRET` of at least 32 characters, `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least 15 characters. To generate a secret, run `node -p "require('node:crypto').randomBytes(32).toString('base64url')"` locally. Keep the template localhost origins and leave unused OAuth, rehearsal and backfill variables empty.

3. For a **fresh installation**, choose an unused Docker volume name, for example `nextpress_local_pg18`, and set `POSTGRES_VOLUME_NAME` in the root `.env` to that name. Compose requires this external volume to exist:

   ```sh
   docker volume create nextpress_local_pg18
   npm run db:up
   ```

   Continue when `db:up` reports readiness. Compose publishes `cms` on `127.0.0.1:5432`. The API template selects that address for the API and database tooling. Run `npm run db:target` to confirm the host, port, database and schema before continuing.

4. Generate the client, apply committed migrations and create the administrator:

   ```sh
   npm run prisma:generate
   npm run prisma:deploy
   npm run admin:bootstrap
   ```

   Bootstrap creates required roles and settings without demo content. It preserves an existing account password on rerun. Use `npm run prisma:migrate` only when intentionally developing a schema migration; normal setup applies the committed chain with `prisma:deploy`. Do not reset an existing database to resolve migration errors.

5. Start all applications:

   ```sh
   npm run dev
   ```

   Open the [Admin sign-in](http://localhost:49101/auth/sign-in) and [public website](http://localhost:49100). A fresh database has no published pages or posts.

### Start an existing installation

Set `DATABASE_URL` once in `apps/api/.env` and run `npm run db:target` before database startup or writes. Existing API settings take effect immediately for the CLI. You can remove the obsolete `DATABASE_URL` line from `packages/db/.env` at your convenience. Start the service that matches the reported target.

- **Compose `cms` on port 5432.** Confirm that `POSTGRES_VOLUME_NAME` matches the existing PostgreSQL 18 parent mount, then run `npm run db:up`. Inspect the mount without printing container environment variables with `docker inspect --format '{{json .Mounts}}' nextpress-db-1` if using the default Compose project name.
- **Existing editorial database on port 55434.** Confirm that `nextpress-dev-editorial-db` uses volume `nextpress_dev_editorial_pg18` mounted at `/var/lib/postgresql`. If the container is stopped, run `docker start nextpress-dev-editorial-db`, then run `npm run db:ready -- editorial`. The existing container maps host port `55434` to internal port `5432` and serves `nextpress_dev_editorial`. If the container is missing, inspect Docker's active context and the original volume, then recover the original configuration from your infrastructure records or backups before starting the apps.

Once PostgreSQL is accepting connections, run `npm run dev` if the applications are stopped. The readiness probe retries over internal TCP and checks whether PostgreSQL is accepting connections. The API verifies that the host mapping, credentials and schema work together. Check these URLs:

- [Public settings](http://localhost:49102/api/public/settings) exercises the database-backed settings read.
- [Session discovery](http://localhost:49102/api/discovery/session) exercises API session routing. Anonymous requests should succeed without a session.

The `bootstrap` shortcut checks for the local Compose target before running `db:up` followed by `dev`. For editorial development, use the editorial sequence above.

### Configuration and troubleshooting

| Command or service                                    | Where it reads configuration                                                                                                                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API, Admin and Web                                    | Each Next.js workspace reads process variables first, then its own `.env.development.local`, `.env.local`, `.env.development` and `.env` in development. Production uses the corresponding `.env.production*` files. |
| `db:target`, Prisma CLI, `db:seed`, `admin:bootstrap` | Same API environment lookup, with development as the default. Set `NODE_ENV=production` in the process to select the production files. These commands report the target without credentials.                         |
| Optional demo content seed                            | Set `ALLOW_DEVELOPMENT_CONTENT_SEED=true` in the shell or `packages/db/.env`. The seed accepts only its permitted local database names and refuses the editorial database.                                           |
| `db:up` and `db:ready -- compose`                     | Docker Compose selects the external volume from the shell or root `.env`. The root file configures Compose only.                                                                                                     |

- If Docker cannot start the database, check the Docker context, service/container status, volume mount and host port. Preserve both data volumes during recovery. For migration failures, check the configured target and its migration role before retrying. A runtime role may lack access to the migration history.
- For a temporary target switch, use the same shell `DATABASE_URL` for `db:target`, the API and any database commands, then restart the API. When supplying different migration credentials through a shell override, keep the host, port, database and schema identical to the API target.
- If Admin or Web cannot reach the API, confirm `API_INTERNAL_ORIGIN` points to the API at port 49102 and check the two endpoints above. For Live Preview, set both peer origins from the templates and restart the apps.
- For cross-service request correlation, set the same independently generated `NEXTPRESS_REQUEST_CORRELATION_SECRET` of at least 32 bytes in API, Admin and Web and restart all three. Without a valid signature the API generates a request ID locally. Keep the value server-only.

### Automated tests and production

Use the [API's isolated integration test workflow](apps/api/README.md#isolated-integration-tests) for database-backed tests. CI and the guarded test runners provision their own isolated services.

The example database credentials and localhost URLs are for local development. In production, inject `DATABASE_URL` into the deployed API and migration job. Provide the deployed Admin HTTPS origin and a unique auth secret to the API, a fixed internal API origin to Admin and Web, and the public canonical origin to Web. Keep real environment files and secrets out of Git.

## Documentation

See the [workspace guides](apps/api/README.md).
