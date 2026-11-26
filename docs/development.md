# Development

Commands below are rooted in the repository scripts and current Quick Start. Use Node.js 24.x (`.nvmrc`), npm 12.2.2, and Docker Compose with PostgreSQL 18 for the standard local setup.

## Setup

1. Install with `npm ci`.
2. Copy `.env.example`, `apps/api/.env.example`, `apps/admin/.env.example`, and `apps/web/.env.example` to the corresponding `.env` files when needed. Keep secrets local. Set a unique `BETTER_AUTH_SECRET` (at least 32 characters), administrator bootstrap credentials, and local `DATABASE_URL` in `apps/api/.env`.
3. For a fresh local database, set a new `POSTGRES_VOLUME_NAME` in root `.env`, create it, then run `npm run db:up`. Root Compose configuration is separate from API-owned database environment resolution.
4. Verify the selected DB with `npm run db:target` before database operations. API `.env` is the normal authoritative `DATABASE_URL`; explicit process-level overrides take precedence.
5. Keep the API runtime identity (`nextpress_dev_api`) in `apps/api/.env`. The local editorial migration identity is separate: copy `packages/db/.env.migrator.example` to the ignored `packages/db/.env.migrator` and set `MIGRATION_DATABASE_URL` to the dedicated `nextpress_dev_migrator` URL. Do not grant the runtime role schema ownership or migration-history access. For migration work, verify both `npm run db:target` and `npm run db:migration-target`, inspect pending migrations with `npm run db:migration-ready`, deploy with `npm --workspace @nextpress/db run prisma:deploy`, then rerun readiness. Local editorial migrations fail early if the runtime role is selected. Explicit process-level `DATABASE_URL` overrides remain supported and must identify the migration role for this editorial database. Production and CI continue using their injected `DATABASE_URL`; the local credential is optional outside the editorial development target. See the API [database configuration](../apps/api/README.md#configuration).
6. Run `npm run prisma:generate`, then `npm run admin:bootstrap`.
7. Start with `npm run dev`. Admin is at port 49101, Public Web at 49100, and API at 49102. `npm run dev:admin` and `npm run dev:web` start the respective app with API.

### Prisma schema and client changes

After changing `packages/db/prisma/schema.prisma`, generate the Prisma Client
with `npm run prisma:generate` before typechecking, building, or starting an
application that imports the database package. Client generation and database
migrations are separate steps: deploy a migration when the schema change needs
a database change, then regenerate the client. A successful migration does not
refresh generated client code, and application startup does not generate it
automatically. Restart already-running API processes after client generation so
they load the generated client version that matches the schema. Preserve the
separate runtime and migration database identities when running these commands.

Do not run migrations/bootstrap against a database containing data you need to preserve. Bootstrap preserves an existing administrator password on rerun.

### Local migration credential recovery

If Prisma reports `permission denied for table _prisma_migrations`, first compare
the runtime and migration targets. The editorial runtime role intentionally has
no migration-history access; do not fix this by granting it privileges. If the
local migrator password is unavailable, use the verified editorial container's
trusted local `nextpress_dev_provisioner` administration path to rotate only
`nextpress_dev_migrator` with a cryptographically generated password, then store
the matching URL only in the ignored `packages/db/.env.migrator` file. Never
print the generated password. Verify the
file is ignored with `git check-ignore packages/db/.env.migrator`, check both
targets, and run migration readiness before deploying. Do not deploy as the
provisioner or modify `_prisma_migrations` manually.

## Useful checks

```sh
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
npm run prisma:validate
npm run openapi:validate
```

`npm test` does not provision PostgreSQL. API database integration suites are opt-in and use disposable local PostgreSQL through guarded runners; do not point them at development/shared/production data. Run workspace checks with `npm --workspace api run lint`, `npm --workspace admin run lint`, or the relevant workspace `test`/`typecheck` scripts.

Run the guarded PostgreSQL integration suites with `npm exec --workspace api -- tsx scripts/b04-postgres.ts content` and `npm exec --workspace api -- tsx scripts/b04-postgres.ts security`. To exercise database outage and recovery across the built Web, Admin, and API applications, run `npm --workspace api run test:postgres-outage`. This workflow creates and verifies a uniquely labeled PostgreSQL container and named volume, publishes it on loopback port 55436, and starts the applications on ports 49450–49452. It stops and removes only resources whose run labels, image, mounts, and port binding match the current run. Keep those ports free while it runs; cleanup removes the disposable container and volume.

### Development and release verification

Keep development checks scoped to the task. When unrelated staged or unstaged
changes exist, format only task-owned files with explicit paths, for example:

```sh
npm run format:changed -- --files apps/admin/src/ui/theme/foundation.css
npm run format:check:changed -- --files apps/admin/src/ui/theme/foundation.css
npm --workspace admin run lint
```

Run focused tests and typechecks when the change affects behavior or types. For
CSS-only changes, use the relevant formatter and owning workspace lint; perform
a targeted rendered-browser check only when needed to confirm the affected
layout. Minor styling changes do not require Playwright E2E, full visual
regression, cross-browser audits, or full workspace verification by default.

`npm run check:changed` is an aggregate working-tree check: it intentionally
collects staged, unstaged, and untracked paths and runs affected verification.
Unknown or root-level paths can select full workspace verification. Use it when
that combined scope is intended, not automatically for an individual task with
unrelated staged changes. Its `--files` option is available only for formatter
modes.

Pre-commit verification has a separate purpose. Husky and lint-staged validate
the staged snapshot, including formatting, lint, readability, and affected
unit tests, while preserving unstaged edits. Keep this gate enabled and test
hook behavior only with disposable fixtures. CI and release verification retain
their existing change detection, conservative full-validation fallback, and
required full checks; task-scoped development commands do not replace them.

Do not stage or alter another user's work to validate it.

CI compares a pull request's base to the checked-out merge commit, or a push's previous revision to its checked-out commit. Turbo selects changed workspaces and their dependents. Root configuration, missing comparison history, and unclassified inputs select full validation. Documentation-only changes skip workspace validation. Agent changes and workspace validation each require the dedicated agent-resource job, which runs once.

Workspace validation retains lint, typecheck, and coverage. Selected unit-test-only changes skip production builds. Changes outside the narrowly scoped integration exemptions run schema validation and the guarded PostgreSQL rehearsals. The content rehearsal also uses Chromium for authenticated browser flows. Prisma client generation follows the task graph and can run without a database server.

The stable `Quality Gates` check requires successful selection and production dependency audit, and checks that the agent and workspace jobs either succeeded or were correctly skipped. CI persists a dedicated Turbo workspace lint cache across runs. Only pushes to `master` publish it. Other Turbo task artifacts remain local to the runner.

## Troubleshooting

- Wrong database target: inspect with `npm run db:target`; check process overrides before editing API `.env`.
- Missing Prisma client: run `npm run prisma:generate` before direct DB/API builds.
- Authentication bootstrap failure: check API URL/origin settings and local secret/credentials; never paste secrets into logs or docs.
- Missing published public content on a fresh DB is expected until content is created and published.
- Keep media storage (`MEDIA_STORAGE_ROOT` or API `.media`) outside `public/`; local media needs backup alongside the database.
- Apply the media metadata migration before using the Admin Media Library. The migration preserves existing asset IDs and storage keys, and adds restrictive foreign-key deletion for cover and Gallery references. Use the disposable PostgreSQL and Chromium harness for write-heavy verification.

See workspace READMEs for API-only integration guidance and API reference behavior.

Prefer the installed framework, runtime, or browser capability when it fits the requirements. Follow the [native-first development principle](../AGENTS.md#native-first-development) when choosing an implementation or dependency.

### Disposable Docker cleanup

The Chromium and guarded PostgreSQL runners keep databases in run-owned containers with temporary data on dedicated networks. The database outage runner uses an explicitly labeled volume. Each runner checks the local Docker endpoint and verifies ownership before removing its resources on success or failure. Interrupt handling reaches cleanup at the next checkpoint, which can be delayed while a subprocess is running. Forced process termination or loss of the Docker daemon can leave resources behind. Use the run ID and inspect the container, network, and any volume before recovering them. Preserve anything whose ownership cannot be established.

For a focused Chromium run that provisions a disposable database, applies migrations, verifies the legacy upgrade, and runs the requested browser tests separately from the B04 database suites, use:

```sh
npm run test:e2e -- --browser-only e2e/navigation.spec.ts
```

### Admin media, navigation, and preview

The Media Library uses a single API query for mixed image and PDF results. The
existing image-only API default and document upload route remain compatible.
The former Document Library URL opens the Documents view in Media Library.
Admin asset pickers use the same uploader and library browser.

Editor asset actions save references through the structured content document.
Images and PDFs currently append to that document. Rich text links are stored
on selected text and accept site-relative paths and HTTPS URLs.

Menu moves update the navigation draft. Saving uses the existing transactional
menu snapshot and version check. Menu nesting is independent of Page hierarchy.

Local Live Preview expects Admin at `http://localhost:49101` and Web at
`http://localhost:49100`. Configure `NEXT_PUBLIC_PREVIEW_ORIGIN` in Admin and
`PREVIEW_ADMIN_ORIGIN` in Web using the opposite application's exact origin.
Restart the development processes after changing either value. Private-draft
admission is controlled separately.
