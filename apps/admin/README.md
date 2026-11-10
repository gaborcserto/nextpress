# Admin application

The admin workspace is the authenticated Next.js administration application. It contains the Better Auth browser client, an HTTP forwarding boundary, and the CMS screens.

Implemented areas include:

- email/password sign-in, sign-up, disabled recovery screens, and configured OAuth provider support;
- dashboard, pages, posts, taxonomy, users, settings, and profile/session screens;
- role-aware presentation using API session discovery;
- HTTP consumers for authentication, content, taxonomy, users, settings and health.

Run it from the repository root with:

```bash
npm run dev:admin
```

This command starts both admin (49101) and API (49102). Configure `apps/api/.env` from its template before starting; it owns DATABASE_URL and Better Auth secrets. To start only the UI, use `npm --workspace admin run dev` with an API already running.

Admin listens on `http://localhost:49101`. Configure local values in `apps/admin/.env` using [`.env.example`](.env.example). The root [README](../../README.md) documents repository setup, shared commands, and testing.

Useful workspace checks:

```bash
npm --workspace admin run lint
npm --workspace admin run typecheck
npm --workspace admin test
```

The public web application is a separate workspace and is not rendered by this application.

## Admin skin styling

Admin palettes remain local to `src/app/globals.css`. Its custom DaisyUI `light`
and `dark` themes are the authoritative color definitions; built-in DaisyUI
themes are disabled to avoid duplicate registrations. The compiled default skin
also defines the surface radius, default control radius, and topbar shadow tokens
used by admin primitives. Keep explicit component radius overrides for cases that
intentionally differ from those defaults.

`--radius-surface` preserves the 12px defaults for Box, Section, dropdown menus,
sticky actions, and the topbar. `--radius-control` preserves the 6px defaults for
Input and dropdown items; explicit Input `rounded` values still take precedence.
DaisyUI controls continue to use its existing `--radius-field`, `--radius-box`,
and `--radius-selector` tokens. `--shadow-topbar` preserves the scrolled topbar's
existing shadow.

## API reference and health

In development, open [API documentation](http://localhost:49101/api-docs) or
[OpenAPI JSON](http://localhost:49101/api/openapi). Both return 404 outside
development. The interactive reference executes requests in the current browser
session; write requests can modify real data and remain subject to the API's
normal authentication, authorization, CSRF, and validation checks. `GET
/api/health` is a public, uncached application liveness check returning
`{ "status": "ok" }` without a database check.

See the [API contract workflow](../../.agents/skills/nextpress-api-contracts/SKILL.md)
for contract ownership and maintenance. Run
`npm run openapi:validate` from the root to validate the schema and route coverage.

The docs page renders the exact-pinned local `swagger-ui-dist` bundle outside
the Next.js React tree. Its development-only asset route allowlists the required
JavaScript bundle and stylesheet.

The public `/health` page is a human-readable dashboard that checks API availability
through `/api/health`, measures browser-observed response time, and records the
last successful check. It supports manual refresh and shows loading and error
states. Its cards use the admin's existing light and dark theme tokens. Runtime
or deployment information may display `Unknown` when unavailable. `/api/health`
remains the machine-readable, uncached liveness endpoint; it does not check
database readiness or provide detailed infrastructure monitoring.

## HTTP integration

All backend operations, including Better Auth and authorization, belong to apps/api. The browser uses relative /api/* through a fixed-origin proxy; server-rendered authentication reads discovery over HTTP. Admin requires only API_INTERNAL_ORIGIN. Backend credentials and bootstrap settings belong to apps/api/.env. See [backend boundaries](../../docs/backend-boundaries.md) and [API security policies](../api/README.md).
