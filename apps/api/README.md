# API

The `api` workspace owns Better Auth, server-side authorization, API routes, validation, content services and database access. The admin forwards browser requests here; the public website consumes anonymous `/api/public/*` projections.

Follow the repository [Quick Start](../../README.md#quick-start) for installation, environment setup, migrations and administrator bootstrap. `npm run dev:api` from the root listens on `http://localhost:49102`.

## Configuration

Set the shared development `DATABASE_URL` in the API workspace. Prisma CLI and both bootstrap and seed commands use the API's environment lookup. Run `npm run db:target` from the root to inspect the selected database without credentials. [API environment template](.env.example)

The API uses the restricted `nextpress_dev_api` database role at runtime. Prisma migrations must use the separately provisioned `nextpress_dev_migrator` role, which owns the application schema and Prisma migration history. Do not grant schema ownership or migration-table access to the runtime role. For local work, provide the migrator URL only as a temporary process-level `DATABASE_URL` override; never store it in an API environment file or expose it to browser configuration. Before applying migrations, run `npm run db:target` and `npm run db:migration-ready` with that same override. The readiness command is read-only and reports the effective target plus pending migrations. Apply reviewed migrations with `npm --workspace @nextpress/db run prisma:deploy`, then rerun readiness. Local provisioner access is for role setup only; it is not the application's migration credential.

The runtime role needs explicit privileges on each application table. The navigation migration creates its tables under the migrator owner, so grant `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on `NavigationMenu`, `NavigationAssignment`, and `NavigationItem` to `nextpress_dev_api` through the local database provisioner after deploying that migration. Keep the grant limited to those tables; the runtime role must not own the schema or access `_prisma_migrations`.

`BETTER_AUTH_URL` is the browser-facing Admin origin and `BETTER_AUTH_SECRET` must be unique and at least 32 characters. Existing `NEXT_PUBLIC_BETTER_AUTH_URL` and `NEXT_PUBLIC_ADMIN_URL` entries are compatibility aliases that also contribute trusted origins. Fresh installations can set just `BETTER_AUTH_URL`. OAuth providers require enabling in site settings and complete credentials, from settings or environment variables.

Media files use a private local directory: `MEDIA_STORAGE_ROOT`, or `.media` relative to the API working directory. Back it up alongside PostgreSQL; do not put it under `public/`.

Private draft admission is off by default and development/test only. The environment switch alone is insufficient: independently verified database identity, a restricted non-owner role, installed writer fences and maintenance checks are also required. Rehearsal supports save, restoration, publish/unpublish and pinned scheduling. No unattended scheduler is installed. Execution callers must carry `nextCursor` as `after` until a sweep completes, then restart to retry refusals; use a caller timeout of at least 65 seconds. The development OpenAPI reference describes the active execution contract. Do not enable rehearsal against the normal development or a shared database by copying test credentials.

## API reference

In development, `/api/openapi` serves the OpenAPI document. The admin exposes the interactive reference at `http://localhost:49101/api-docs` and forwards its JSON route. These documentation routes return 404 outside development; this does not replace endpoint authentication or authorization. Interactive requests use the current session and can modify data.

Run `npm run openapi:validate` from the repository root to validate the document and route coverage.

## Workspace checks

From the repository root:

```sh
npm --workspace api run lint
npm --workspace api run typecheck
npm --workspace api test
npm --workspace api run build
```

Generate Prisma before a direct workspace build using `npm run prisma:generate`. Root development and verification commands are listed in the [repository README](../../README.md).

## Isolated integration tests

Normal `npm test` does not provision PostgreSQL; database suites are opt-in. Backend integration runners provision their own disposable PostgreSQL 18 cluster, verify its identity and remove it after the run. They are separate from `docker-compose.yml` and must never target a development, shared or production database.

Prerequisites: installed dependencies, generated Prisma client, Docker with a local Linux engine and Playwright Chromium. The guarded runner supports Linux's `default` Docker context at `/var/run/docker.sock` and Windows Docker Desktop's `desktop-linux` context. Other platforms or remote Docker endpoints are refused. Install only Chromium, from the root:

```sh
npx playwright install chromium
```

On Linux, use `npx playwright install --with-deps chromium` if browser system libraries are missing; CI uses that form before its browser-dependent backend suite.

Run these **from `apps/api`**, serially:

```sh
npx tsx scripts/b04-postgres.ts content
npx tsx scripts/b04-postgres.ts security
```

The content family includes database transactions, writer fencing, private-draft HTTP tests with real Better Auth sessions and Chromium editor flows. HTTP/browser processes use a non-owner application role. The security family exercises the isolated authentication lifecycle. The runner sets its own database/test environment and uses an identity manifest; do not hand-configure the opt-in database URLs to bypass it.

Keep ports `55432` (content database), `55433` (security database), `49312` (test API) and `49311` (test admin) free. Run the content family without simultaneous dev/build processes for the same apps. If interrupted, preserve its `.b04-disposable.json` evidence and inspect exact resource identity before recovery; do not prune unrelated Docker resources or delete the manifest to bypass admission.

The separate root `npm run test:e2e` command runs the broader Playwright suite with its own disposable database on port `55441`; it does not replace these backend families. Its server ports are defined in [playwright.config.ts](../../playwright.config.ts). Do not run the runners concurrently. A skipped opt-in suite is not a passing database or browser test.
