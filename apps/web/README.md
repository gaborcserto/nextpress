# Public web application

The web workspace is the public-facing Next.js application. Its current implementation is the default Next.js starter home page; CMS content is not yet rendered here.

Run it from the repository root with:

```bash
npm run dev:web
```

It listens on `http://127.0.0.1:49100`. Configure local values in `apps/web/.env` using [`.env.example`](.env.example). The root [README](../../README.md) documents repository setup, shared commands, and testing.

Useful workspace checks:

```bash
npm --workspace web run lint
npm --workspace web run typecheck
npm --workspace web test
```

## Public site settings

Admin owns settings mutation through its ADMIN-only settings API. The database
package owns `SiteSettings` persistence; web reads the singleton `default` row
through `src/lib/settings/public-site-settings.server.ts`, following the existing
server-only public content access pattern. Web does not call admin APIs or import
admin code, and no public settings endpoint is needed.

`PublicSiteSettings` exposes only `siteName` and `siteDescription`. Both the Prisma
selection and returned object allow-list these fields. Roles, identifiers,
timestamps, OAuth providers and credentials stay outside the public contract;
`siteUrl` and `ogImageUrl` are also excluded until a public feature needs them.
Adding a persistence field does not add it to the public projection.

The root layout passes the name to the existing header/footer and uses the name
and description for its existing metadata. Rendering is request-time so admin
edits do not require a rebuild; React `cache` deduplicates reads within a server
render without caching settings across requests. No client fetching or settings
state is introduced.

A missing row or blank identity uses the existing `NextPress` name and
`A publication powered by NextPress.` description. Public reads never create
settings. Database/configuration failures propagate instead of becoming defaults.
Web requires its existing server-only `DATABASE_URL`; no auth or environment
values enter the public projection.
