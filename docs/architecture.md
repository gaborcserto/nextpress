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

Legacy page fields and `PageRevision` coexist with private working aggregates for existing Posts and Pages. The default editor uses an explicit save with a working-version check. The rehearsal editor autosaves supported field changes after one second of inactivity. One command runs at a time, and a lost acknowledgement is retried with the same request ID and payload. Edits made during a save stay local until their own revision is acknowledged. Unsent changes trigger navigation warnings and are kept only in memory.

When an admitted editor opens an item with private changes, the editor offers to recover the latest private revision or confirm a discard. New revisions carry a server-recorded timestamp. Older revisions can be recovered with the revision number and may have no save time. Discard uses a version-checked reset to the authoritative source and retains immutable history. Stale draft or source revisions stop writes. Editors can retain or copy their local values, then explicitly reload or reset as appropriate. Changes made during a reload prevent it from replacing the current form.

Live Preview shows the current form, including unsaved edits and page-type changes. Saved Preview uses the acknowledged private working snapshot in rehearsal and the authoritative current revision in the default editor. A historical revision preview shows the explicitly selected revision. Older historical revisions lack listing-filter metadata.

The Web preview uses the public Blog shell, site appearance settings, detail and archive views, structured page blocks, and English or Hungarian messages. Standard and managed Home show their page content. The public route keeps its existing homepage lookup and fallback. Posts preview reuses published-post discovery, the selected tag, and the configured pagination or load-more mode. Pagination stays inside the preview session. Gallery shares the localized public empty state. Site navigation and article links still point to public destinations.

The preview window receives the snapshot in memory from the configured Admin origin, opener or parent, and matching session. It does not put draft content into a request, browser storage, or a public URL. Web requests only published data for post archives and listing blocks using bounded public discovery parameters. Private reads continue to use the editor's authenticated endpoints.

Private autosaves preserve publication state. Explicit publication commands use the accepted revision, and scheduling pins a revision for bounded execution. The existing visibility rules continue to control public delivery. The executor requires a separately authorized call, and no background scheduler is installed.

Private endpoints use authenticated roles, ownership checks, origin checks for writes, and private no-store responses. Admission requires `NEXTPRESS_PRIVATE_DRAFT_REHEARSAL=enabled`, development or test mode, an independently verified database and role, and the installed writer guards. Production remains disabled. A deployment rehearsal against representative data, role and database verification, and an operational scheduler are still required before production cutover.

### Admin dashboard

Admin loads one private, non-cacheable summary through its existing same-origin API forwarding. The API admits administrators and editors for the full collection and scopes authors to their own Posts and Pages. Counts and the two lists share a PostgreSQL repeatable-read snapshot and a single publication cutoff. Each list returns at most eight records with an ID tie-break for equal timestamps. Recent updates use the content record's modification date and show its author when available.

The default workflow makes a published-status record with a future date visible once its date is reached. The dashboard reports upcoming dates as scheduled and flags records with missing publication dates separately. The guarded rehearsal keeps pending releases, including overdue ones, and private revisions behind its existing admission checks. The dashboard reads the authoritative Post and Page records and displays date and time in the browser's locale and time zone.

### Admin discovery

Posts and Pages query the existing content endpoints. Search matches title or slug case-insensitively. Both lists filter by editorial publication state and sort by title, creation time, modification time, or stored publication time. Posts also accept exact tag and category slugs. Pages accept Standard, Home, Posts, or Gallery, with legacy layouts grouped under Standard as in the editor. Existing list access still applies before any filter.

The Taxonomy screen queries the authenticated Admin tags endpoint for either Tags or Categories. It searches name or slug and sorts by name, slug, or post usage count. Usage counts measure post links in the existing taxonomy join table. Categories are browseable. Tag creation and guarded deletion still use the existing endpoints. Taxonomy records have no creation or modification fields. A migration would only provide timestamps for future operations, so the lists show existing IDs and usage counts.

Admin discovery uses page numbers from 1 to 10,000 and limits from 1 to 100, with a default of 50. Responses include `items`, `page`, `limit`, `total`, and `pages`. Results and totals share a database snapshot and ordering uses ID as the final tie-breaker. The Admin stores the applied filters and page in the URL. The legacy no-query Admin tags response remains an array of up to 500 items. See the generated OpenAPI reference for parameter names.

Created and modified dates come from their respective stored fields. The list displays a future date on a published-status record as scheduled and a reached date as published. Drafts can retain a stored publication date, which remains available through the compatible API field and its sort order but is omitted from the draft row. A published-status record with a missing date has its own label. Private editorial rehearsal schedules remain in the rehearsal workflow.

## Public templates

Page records use the existing `PageLayout` field for their editorial type. `STANDARD`, `HOME`, `POSTS`, and `GALLERY` map to public `standard`, `home`, `posts`, and `gallery`. The Prisma `PageType` enum continues to distinguish page records from post records. See [the page-type decision](decisions/001-page-type-designations.md) for legacy compatibility and the homepage constraint.

App Router routes load public content and resolve a template registry and appearance settings. The current blog template family has classic, modern, and minimal presets; content-list variants are separate. Appearance presets do not represent arbitrary page-builder blocks. Admin, API, and Web retain separate ownership; shared package exports are browser-safe contracts where needed.

Public post and tag listing requests share `normalizePublicListPagination` in the Web content module. It applies the established default, integer flooring, and shared limit and offset bounds before URL construction. Search has a separate query contract, and pagination rendering remains owned by each appearance-specific view.

## Test and component ownership

API editorial baseline fixtures are owned by `apps/api/src/lib/public`, their only current consumers. Admin private-draft fixtures remain beside the Admin content tests that share them. E2E browser setup stays with the E2E runner; fixtures are not promoted to a generic cross-workspace framework without genuine reuse. Component placement follows its owning app and feature, with tests colocated where established; existing deliberate entry points remain supported. ARCH-F10 review found its original API-to-E2E fixture dependency already resolved by TEST-01B. ARCH-F11's varying historical component grouping does not justify bulk relocation: future moves should accompany substantive edits or verified dead-code cleanup.

## Error handling

- **Web** keeps the localized editorial 404. Route errors use the active Blog preset and color tokens from the root layout. The recovery view renders independently of navigation. When the API explicitly signals unavailability while root settings load, the root layout and metadata use local NextPress defaults so the route boundary can render without the API; unexpected and contract errors still propagate. If the root layout itself fails, the global boundary supplies the built-in skin and NextPress branding.
- **Admin** renders authenticated route failures inside the existing shell when it is available. A failed session or provider lookup reaches a standalone boundary. Only a successful discovery response without a session takes the sign-in redirect. The root fallback and missing-page view use local Admin styles and controls.
- **API** presents branded HTML for GET document navigations that advertise `text/html`. The presentation covers unmatched paths and errors returned by wrapped API handlers. JSON consumers keep their existing bodies and statuses. Known database connectivity failures add `X-NextPress-Service-Unavailable: 1` to the existing JSON 500 response. Web and Admin use this signal to show the 503 recovery view. The API document response uses HTTP 503 for the same failure.

Server logs retain request correlation and failure classifications. The browser-facing availability marker contains no database details. Web and Admin use the error digest to identify the recovery view after Next.js redacts server errors in production. The displayed status identifies the failure. App Router boundaries cannot change HTTP headers after streaming begins, and document failures may use Next.js's HTTP 500 response even when the recovery view displays 503. If an application server is itself offline, any error response must come from the deployment proxy.

## Configuration, observability, and verification

`apps/api/.env` is the normal local source for `DATABASE_URL`; explicit process values take precedence. Prisma/database scripts use the verified API environment resolution. Root `.env` supports Compose separately. Request correlation and structured request logging are implemented in API/shared code; they are not a full observability platform.

Vitest/RTL cover packages and apps; opt-in API integration suites provision disposable PostgreSQL. The guarded PostgreSQL outage workflow owns a uniquely labeled container and named volume, verifies normal operation, stops and restarts that database, checks browser and JSON fallbacks, then removes the verified resources. Playwright provides browser flows. Root scripts coordinate lint, typecheck, tests, build, Prisma tasks, and changed-file checks. GitHub Actions workflows are the CI layer. No Redis, message queue, or microservice infrastructure is established.

See [decisions](decisions/README.md) for evidence-backed decision notes and [current state](current-state.md) for limits.
