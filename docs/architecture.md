# Architecture

## Workspaces and runtime

The npm workspace monorepo is coordinated by Turborepo:

- `apps/api`: Next.js App Router backend; owns Better Auth, authorization, validation, API routes, services, repositories, and DB access.
- `apps/admin`: authenticated Next.js interface; browser requests use same-origin forwarding to the API.
- `apps/web`: public Next.js site; reads anonymous `/api/public/*` projections over HTTP and has no database credentials.
- `packages/db`: Prisma schema/client integration, migrations, configuration, and seeds; PostgreSQL is the data store.
- `packages/shared`: cross-workspace contracts, content types, schemas, and selected utilities.
- `packages/eslint-config`: shared application ESLint configuration.

## Data and security boundaries

Prisma repositories and API services are authoritative for persistence and domain operations. Request handlers validate untrusted inputs and apply authentication/authorization on the server. Better Auth session identity is distinct from role/ownership authorization. Admin UI controls do not enforce protected operations.

Public routes project eligible published content from the existing Page model. A publication time must be present and due. Private working revisions are not public-reader inputs. The web app validates its HTTP response boundary; requests currently use `no-store`. This avoids coupling public rendering to database credentials but means caching and high-throughput behavior remain to be designed and measured.

## Editorial persistence

Legacy page fields and `PageRevision` coexist with newer private working aggregate/revision models. Admission to private-draft rehearsal is guarded by development/test restrictions and database readiness controls. Scheduled-release execution is an explicit bounded operation; no background scheduler is installed. This is an incremental persistence foundation, not a complete production editorial workflow.

## Public templates

App Router routes load public content and resolve a template registry and appearance settings. The current blog template family has classic, modern, and minimal presets; content-list variants are separate. Appearance presets do not represent arbitrary page-builder blocks. Admin, API, and Web retain separate ownership; shared package exports are browser-safe contracts where needed.

## Configuration, observability, and verification

`apps/api/.env` is the normal local source for `DATABASE_URL`; explicit process values take precedence. Prisma/database scripts use the verified API environment resolution. Root `.env` supports Compose separately. Request correlation and structured request logging are implemented in API/shared code; they are not a full observability platform.

Vitest/RTL cover packages and apps; opt-in API integration suites provision disposable PostgreSQL. Playwright provides browser flows. Root scripts coordinate lint, typecheck, tests, build, Prisma tasks, and changed-file checks. GitHub Actions workflows are the CI layer. No Redis, message queue, or microservice infrastructure is established.

See [decisions](decisions/README.md) for evidence-backed decision notes and [current state](current-state.md) for limits.
