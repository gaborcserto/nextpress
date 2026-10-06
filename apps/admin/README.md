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

The database seed requires explicit `ADMIN_EMAIL` and `ADMIN_PASSWORD` values.
Production seed runs additionally require `ALLOW_PRODUCTION_ADMIN_SEED=true`;
use that only for an intentional administrator provisioning operation and keep
the credential out of logs and source control.

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
