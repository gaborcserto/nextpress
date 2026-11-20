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

Public routes project eligible published content from the existing Page model. Detail, navigation, discovery, and public media reference queries share one eligibility predicate. Content must have published status and a publication time at or before the query clock. Private working revisions are not public-reader inputs. The web app validates its HTTP response boundary; requests currently use `no-store`. This avoids coupling public rendering to database credentials but means caching and high-throughput behavior remain to be designed and measured.

## Editorial persistence

The Page and Post editors send publication fields on update only when the selected status or date changes. They adopt the saved publication date, status, and version from the update response. Historical published records without a date remain hidden after ordinary edits.

Legacy page fields and `PageRevision` coexist with newer private working aggregate/revision models. Admission to private-draft rehearsal is guarded by development/test restrictions and database readiness controls. Scheduled-release execution is an explicit bounded operation; no background scheduler is installed. This is an incremental persistence foundation, not a complete production editorial workflow.

## Public templates

App Router routes load public content and resolve a template registry and appearance settings. The current blog template family has classic, modern, and minimal presets; content-list variants are separate. Appearance presets do not represent arbitrary page-builder blocks. Admin, API, and Web retain separate ownership; shared package exports are browser-safe contracts where needed.

Public post and tag listing requests share `normalizePublicListPagination` in the Web content module. It applies the established default, integer flooring, and shared limit and offset bounds before URL construction. Search has a separate query contract, and pagination rendering remains owned by each appearance-specific view.

## Error handling

- **Web** keeps the localized editorial 404. Route errors use the active Blog preset and color tokens from the root layout. The recovery view renders independently of navigation. When the API explicitly signals unavailability while root settings load, the root layout and metadata use local NextPress defaults so the route boundary can render without the API; unexpected and contract errors still propagate. If the root layout itself fails, the global boundary supplies the built-in skin and NextPress branding.
- **Admin** renders authenticated route failures inside the existing shell when it is available. A failed session or provider lookup reaches a standalone boundary. Only a successful discovery response without a session takes the sign-in redirect. The root fallback and missing-page view use local Admin styles and controls.
- **API** presents branded HTML for GET document navigations that advertise `text/html`. The presentation covers unmatched paths and errors returned by wrapped API handlers. JSON consumers keep their existing bodies and statuses. Known database connectivity failures add `X-NextPress-Service-Unavailable: 1` to the existing JSON 500 response. Web and Admin use this signal to show the 503 recovery view. The API document response uses HTTP 503 for the same failure.

Server logs retain request correlation and failure classifications. The browser-facing availability marker contains no database details. Web and Admin use the error digest to identify the recovery view after Next.js redacts server errors in production. The displayed status identifies the failure. App Router boundaries cannot change HTTP headers after streaming begins, and document failures may use Next.js's HTTP 500 response even when the recovery view displays 503. If an application server is itself offline, any error response must come from the deployment proxy.

## Configuration, observability, and verification

`apps/api/.env` is the normal local source for `DATABASE_URL`; explicit process values take precedence. Prisma/database scripts use the verified API environment resolution. Root `.env` supports Compose separately. Request correlation and structured request logging are implemented in API/shared code; they are not a full observability platform.

Vitest/RTL cover packages and apps; opt-in API integration suites provision disposable PostgreSQL. The guarded PostgreSQL outage workflow owns a uniquely labeled container and named volume, verifies normal operation, stops and restarts that database, checks browser and JSON fallbacks, then removes the verified resources. Playwright provides browser flows. Root scripts coordinate lint, typecheck, tests, build, Prisma tasks, and changed-file checks. GitHub Actions workflows are the CI layer. No Redis, message queue, or microservice infrastructure is established.

See [decisions](decisions/README.md) for evidence-backed decision notes and [current state](current-state.md) for limits.
