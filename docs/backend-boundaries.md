# Backend boundaries and API compatibility

The backend belongs exclusively to `apps/api`: route handlers own HTTP validation and authorization, services own business rules, repositories own persistence, and Better Auth owns session validation and its delegated protocol. `packages/db` owns Prisma. `apps/web` still reads the database directly; web migration is deferred to Phase 3. Admin has no database dependency.

## Contracts

Portable Zod schemas are explicitly exported from `@nextpress/shared/api-contracts`. They cover content create/update inputs, editorial records/lists/details, TAG inputs and projections, delivery details/summaries/batches/navigation/settings, discovery, and structured errors. Rich-document definitions remain in `@nextpress/shared/content`. Contracts must never import Prisma, Next.js, React or Slate. The API validation entry points re-export shared inputs for existing callers.

The canonical endpoint reference is the existing OpenAPI document: `npm run openapi:validate` checks syntax and owned route coverage. In development inspect `/api-docs` or `/api/openapi` on the admin host. Better Auth `/api/auth/*` remains delegated and excluded. Settings/user administration retains its existing runtime validation; this change does not imply every CMS operation now has a shared schema.

Preserve existing wire shapes/status codes, field errors, stripping of unknown mutation fields, and partial PUT behavior. Editorial detail responses retain rich block arrays; mutation content uses serialized versioned rich documents. Legacy text and Slate-array content remains readable. Page fields returned for legacy editor compatibility do not imply corresponding writable fields. Additive changes should preserve old clients; removing fields or changing visibility/error semantics requires a coordinated migration and regression tests.

## Delivery and editorial policy

The new read-only handlers live under `apps/api/src/app/api/public`: post batches, post/page slug details, navigation, and public settings. Consult OpenAPI for exact paths and parameters. Responses are direct delivery projections rather than editor `{item}` envelopes. Post batches contain `{posts, hasMore}` and use bounded decimal `limit` and `offset`; malformed or duplicate parameters return 400.

Delivery ignores cookies and sessions. Every content query requires the correct type, PUBLISHED status, and a non-null publication time at or before the request. Post order is publication time descending then slug ascending; navigation is title then slug ascending. Details return 404 for missing/hidden content and 500 for unexpected failure. Successful delivery reads use `no-store`; no shared content cache is introduced.

Only author names are public. Editorial IDs, author email, media storage keys, credentials and other internal fields are omitted. Covers follow the web policy: same-origin paths, image MIME, no backslashes or control characters. Invalid rich documents fall back to an empty safe document. Settings select only site name/description, listing mode and batch size. The backend delivery module intentionally mirrors web behavior until web migrates; keep parity tests passing during that transition.

Editorial GET policy remains different: role-scoped reads can include drafts and published records with null publication times. Do not substitute editorial endpoints for delivery. Backend role and ownership checks remain authoritative; clients cannot set author identity or role through content payloads.

## Authentication and topology

Discovery is hosted by API under `/api/discovery`. Session discovery returns `{user: null}` for anonymous requests, otherwise only `{id, name, role}`. It delegates to Better Auth with explicit request headers, then uses the existing live role/default-role policy. Provider discovery returns operational provider names, using the existing enabled-and-configured policy. Neither endpoint returns tokens, session records, email, client IDs or secrets. Discovery responses are private and uncached. Capabilities continue to be enforced by backend role checks rather than a second client-maintained permission model.

The compatibility baseline is same-origin browser access to admin and its API. Local web/admin development ports remain 49100/49101. Cookie names, expiry, domains, Origin/CSRF checks, OAuth callbacks and disabled recovery are unchanged. No cross-origin credential access is enabled.

Admin Route Handlers forward `/api/*` and allowlisted documentation asset requests to the fixed `API_INTERNAL_ORIGIN`. They preserve method/body, status, errors, redirects, Retry-After and separate Set-Cookie headers, including deletion cookies. They forward the original Origin and never synthesize one. Client Host, forwarding and identity headers are discarded. Authenticated responses are private/no-store; redirects are returned without following them. Upstream failures return a minimal 502. SSR uses request-scoped discovery, forwarding cookies to that same fixed origin with a timeout and no-store. API errors propagate to the page error boundary; there is no local auth or privileged fallback.

Configure backend `BETTER_AUTH_URL` as the external admin origin, including production HTTPS, rather than the internal API address. OAuth callback URLs remain on that external origin under `/api/auth/*`. Keep backend-only credentials in `apps/api/.env`; admin needs only `API_INTERNAL_ORIGIN`. Existing optional trusted-origin aliases are backend configuration, not a cross-origin deployment guarantee. Better Auth client uses the current browser origin.


## Content aggregate transactions

Create/update of PAGE and POST now wraps the content write and intended TAG replacement in one Prisma transaction. Explicit TAG validation runs inside the transaction as well as existing service validation. CATEGORY links survive TAG replacement. Omitted update tag IDs leave links alone; an empty array clears TAGs. Slug conflicts retain the existing handling. Transactions contain database work only, with no HTTP calls or automatic retries.

## Disposable PostgreSQL regression test

Normal tests skip the database transaction suite. Never point it at a development or production CMS. It installs a temporary failure trigger and deletes only its own fixtures, but requires a dedicated disposable database. A guard requires matching `DATABASE_URL` and `NEXTPRESS_CONTENT_TEST_DATABASE_URL`, loopback hosting, and a database name beginning `nextpress_phase1_verify`.

Example PowerShell setup from the repository root (test-only password):

```powershell
docker run --detach --name nextpress-phase1-verify --publish 127.0.0.1:55439:5432 --env POSTGRES_PASSWORD=phase1-disposable --env POSTGRES_DB=nextpress_phase1_verify postgres:18-trixie
$env:DATABASE_URL = 'postgresql://postgres:phase1-disposable@127.0.0.1:55439/nextpress_phase1_verify'
npm --workspace @nextpress/db run prisma:deploy
$env:NEXTPRESS_CONTENT_TEST_DATABASE_URL = $env:DATABASE_URL
npm --workspace api test -- src/lib/repos/content-transaction.integration.test.ts
Remove-Item Env:NEXTPRESS_CONTENT_TEST_DATABASE_URL
Remove-Item Env:DATABASE_URL
docker rm --force --volumes nextpress-phase1-verify
```

Wait for PostgreSQL readiness before migration. Run this suite directly, bypassing Turbo caching; a cached unit result does not verify a live database. The suite verifies successful create/update links, invalid references, TAG/CATEGORY isolation and deliberately failed insert rollback. No schema/migration files are changed. Existing auth integration tests have their own opt-in environment and safety rules; these are separate suites.

## Development, builds and deployment limits

Copy the API environment template to `apps/api/.env`, and the admin template to `apps/admin/.env`. Existing installations must move backend credentials out of admin's local environment manually; real environment files are never modified by the migration. Run `npm run dev` for all three apps, or `npm run dev:api` and `npm run dev:admin` in separate terminals. Ports are web 49100, admin 49101, API 49102.

`npm --workspace api run build` and `npm --workspace admin run build` build independently after dependency installation. Generate Prisma with `npm run prisma:generate` first for direct API builds; Turbo attaches generation to API and web tasks, never admin. API requires a valid DATABASE_URL during build because existing route modules initialize Prisma. No database connection is made by the build. Admin builds without database or auth secrets. Production: `npm --workspace api start` listens on 49102; use `npm --workspace admin start -- --port 49101` for admin. Set API_INTERNAL_ORIGIN explicitly in production.

Prisma schema, generated client and migrations remain owned by packages/db. Run migration deployment once in the trusted backend release workflow, not from admin. Bootstrap now loads apps/api/.env with unchanged production opt-in policies. GET /api/health is liveness only, not database readiness. Development OpenAPI JSON is served by API; the interactive UI remains at /api-docs on admin and uses proxied API assets.

Initial compatibility model: one browser origin, one API process, private trusted network between admin and API. TLS termination, body/time/connection limits and ingress header policy are deployment responsibilities. API_INTERNAL_ORIGIN must be operator-controlled and network-restricted. Process-local rate limits require a single process or separately verified edge coordination. Cross-domain cookies, cross-origin OAuth, horizontally scaled throttling, serverless packaging and independently packaged production deployments remain unsupported until verified. No CORS or distributed limiter is added here. Real OAuth credentials and browser tests are still required before production topology acceptance.
