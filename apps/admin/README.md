# Admin application

The admin workspace is the authenticated Next.js administration application. It contains the Better Auth integration, role-aware API routes, and the current CMS administration screens.

Implemented areas include:

- email/password sign-in, sign-up, password reset flows, and configured OAuth provider support;
- dashboard, pages, posts, taxonomy, users, settings, and profile/session screens;
- server-side authorization for protected API routes using the supported ADMIN, EDITOR, AUTHOR, and SUBSCRIBER roles;
- API routes for authentication, pages, posts, tags, users, settings, and health checking.

Run it from the repository root with:

```bash
npm run dev:admin
```

It listens on `http://127.0.0.1:49101`. Configure local values in `apps/admin/.env` using [`.env.example`](.env.example). The root [README](../../README.md) documents repository setup, shared commands, and testing.

Useful workspace checks:

```bash
npm --workspace admin run lint
npm --workspace admin run typecheck
npm --workspace admin test
```

The public web application is a separate workspace and is not rendered by this application.

## API reference and health

In development, open [API documentation](http://127.0.0.1:49101/api-docs) or
[OpenAPI JSON](http://127.0.0.1:49101/api/openapi). Both return 404 outside
development; the reference does not execute requests. `GET /api/health` is a
public, uncached application liveness check returning `{ "status": "ok" }`
without a database check.

See [API contract workflow](../../docs/api.md) for contract ownership and
maintenance. Run
`npm run openapi:validate` from the root to validate the schema and route coverage.

## Sessions and browser mutations

Better Auth owns signed session cookies, database session persistence and lookup,
credential/OAuth sign-in, OAuth state/PKCE validation, and cookie removal on logout.
Cookies are host-only, HttpOnly, SameSite=Lax and Path=/; HTTPS uses Secure and the
library's `__Secure-` prefix. Local HTTP development uses unprefixed cookies.
Production requires configured HTTPS application URLs; local fallback URLs are
not production origins. Set `BETTER_AUTH_URL` to the admin application's HTTPS
origin and `BETTER_AUTH_SECRET` to a unique random value with at least 32
characters. Set `DATABASE_URL` to the production PostgreSQL connection URL.
Keep any configured public auth/admin URLs on the same trusted origins. OAuth is
optional; each provider remains unavailable until it has both a client ID and
secret from either the server environment or admin settings.

The application can enforce secure cookies, origin checks, and its response
headers. Deployment must terminate valid TLS, redirect HTTP to HTTPS, preserve
the application security headers without weakening or replacing CSP, and deliver
HSTS over HTTPS. If a reverse proxy is used, configure its trusted-proxy behavior
for the chosen runtime; the application does not use Host or forwarded headers
to establish trusted origins.

Run `npm run admin:bootstrap` from the repository root to provision the initial
administrator and initialize roles and site settings. This command loads
`apps/admin/.env` and requires `DATABASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
Production provisioning additionally requires `ALLOW_PRODUCTION_ADMIN_SEED=true`,
as an explicit administrator-only operation. Existing credentials are preserved.
Keep the administrator credential out of logs and source control.

Local content fixtures are a separate `npm run db:seed` operation using
`packages/db/.env`; they do not require administrator credentials and always
reject production execution.

Sessions expire seven days after creation without rolling renewal. This keeps
the existing lifetime while bounding stolen-session reuse; active users must
sign in again weekly. Existing stored expiry dates are honored. `rememberMe=false`
uses a browser-session cookie and a one-day server lifetime. Cookie caching stays
disabled so revocation is checked against the database. Roles are read from the
database on each request, independently of the session payload.

Password changes always revoke every old session and issue a fresh current
session, even if a client requests otherwise. Password recovery remains disabled
until email delivery is integrated; when activated, Better Auth is configured to
revoke all existing sessions after reset. Admin user creation provisions new
accounts only and does not replace existing credentials. Logout checks server
revocation before reporting success; storage failures return an error and must
be retried. Provider logout remains Better Auth/provider behavior.

All custom cookie-authenticated API routes must use `withAuth`. For mutations it
checks an exact serialized `Origin` against configured application origins before
session lookup or role checks. Missing, null, malformed and untrusted origins
are rejected with 403; there is no server-to-server exception or Referer fallback.
Request URLs, Host, forwarded headers and CORS are not evidence of trust.
Development additionally allows localhost and 127.0.0.1 on port 49101 only.
Production includes no implicit development origins.

POST/PUT/PATCH and any other mutation with a body or Content-Type require
`application/json` (case-insensitive, with parameters such as charset allowed);
other types return 415. Trusted bodyless DELETE requests need no Content-Type.
GET/HEAD/OPTIONS are unchanged. Better Auth routes use its own origin and media
checks; OAuth callback formats remain library-managed. Browser fetch supplies
Origin automatically; non-browser callers of custom mutations must supply it.

## Application abuse controls

The Node.js admin runtime uses bounded in-memory counters at the authentication
hooks and selected authorized mutation handlers. Counters outlive each newly
constructed Better Auth instance, but are local to a loaded server module.
Processes, server bundles, workers and serverless isolates can have independent
counters. Restarting or deploying clears them. These controls are best-effort
local protection, not distributed throttling or DDoS protection.

Credential sign-in allows five attempts per normalized email per fixed minute.
Current-password changes and server password verification share this bucket.
Attempts are reserved synchronously before validation and password work, including
failures for nonexistent accounts; successful sign-in clears only that account's
bucket. Rejected requests never prolong a cooldown. There is no permanent lockout.
The shared credential-work budget is 60 attempts per minute across all accounts.
Hashing and verification additionally share four concurrent slots, with immediate
429 rejection rather than an unbounded queue. Legacy bcrypt remains supported.

Credential registration allows three attempts per normalized email and ten total
attempts per ten minutes. Duplicate and invalid registration attempts count too.
Better Auth's user-creation hook allows 30 new accounts per hour, including OAuth
accounts, and always assigns SUBSCRIBER. OAuth initiation, linking and callbacks
share 60 attempts per minute. The HTTP credential/OAuth boundary additionally
allows 120 requests per minute before body parsing or provider configuration
queries, so malformed JSON also spends a budget. Auth bodies are capped at 16 KiB;
signup/profile names and image URLs are capped at 200 and 2048 characters.

Authorized mutations use authenticated database user IDs, independently of role:

| Operation group | Fixed-window allowance per user |
| --- | --- |
| Page/post creation, combined | 30 per ten minutes |
| Page/post update, publish and delete, combined | 120 per minute |
| Tag creation, deletion and relationship changes, combined | 120 per minute |
| User provisioning, role changes and deletion, combined | 30 per ten minutes |
| Settings updates | 20 per minute |
| Better Auth profile/email/link/token mutations | 30 per minute |
| Better Auth session/account listing | 30 per minute |

ADMIN has the same limits. Origin and role checks run first; accepted requests
spend the mutation budget before body buffering or database writes. Rejected or
invalid mutations do not refund it. Reads, logout and session revocation are
available independently of mutation budgets; session/account listing has its own
budget because Better Auth returns the complete account-owned set. Existing read bounds remain: 100
content results per page, page numbers at most 10,000, 20 tag-search results,
200-character tag queries, and 500 rows for user/tag/parent selectors. Counts and
substring searches still cost more as the database grows; result bounds do not
make queries constant-cost. Tag creation makes at most ten slug-collision lookups.
There is no media upload endpoint or configured remote image-optimization source.

Rate-limit responses use 429, standard Retry-After seconds and Cache-Control:
no-store, without keys, counters or account-existence details. The password-work
concurrency gate returns a one-second retry suggestion. Only a generic throttle
event is logged, at most once per minute per loaded module. Better Auth warnings
and errors are also reduced to one generic event per minute, discarding raw
provider errors and arguments. No identities, bodies, credentials, tokens or
OAuth codes are logged by these controls.

Account and action tables each retain at most 4096 SHA-256 identity digests; the
process-budget table retains at most 16 fixed keys. Each consume operation removes
expired entries. If full, new keys are rejected until the earliest expiry instead
of evicting live cooldowns. No timer, external store, schema or migration is needed.
Idle tables stay bounded until the next request reclaims stale state. Tests clear
the tables explicitly and use controlled clocks without sleeping.

No trusted proxy topology is configured. Better Auth IP tracking and its default
source-IP limiter are explicitly disabled; X-Forwarded-For, X-Real-IP, Forwarded,
Host and arbitrary proxy headers are not abuse identities. Account normalization
uses the existing email schema, with trimming and case folding; provider-specific
alias rewriting is intentionally absent. An attacker can consume another user's
temporary account allowance or the shared process budget. This temporary denial
of service trade-off cannot be eliminated by inventing a source identity.

Deployment must establish the ingress trust boundary before introducing source-IP
limits: strip client-supplied forwarding headers, ensure all ingress passes through
the trusted boundary, and configure the actual runtime/proxy chain. Global and
per-source request/connection limits, body/time limits, bot protection and DDoS
mitigation belong there. Multiple instances also need coordinated account limits
at the edge or an atomic distributed store; rotating instances otherwise bypasses
local counters. No provider or external store is selected by this repository.

Recovery and verification remain uniformly unavailable (503) before account lookup
or token creation. Before enabling delivery, add per-account and trustworthy-source
send budgets, a shared delivery budget, and tests for token expiry, single use and
replay using the installed Better Auth implementation. Existing disabled delivery
must not be treated as protection for a future enabled workflow.
