# Web

The `web` workspace renders public pages and posts using the API's anonymous `/api/public/*` endpoints. It has no database connection or authentication server. Requests are uncached and use a ten-second timeout; missing content maps to not-found and other upstream failures reach the app error boundaries.

Follow the repository [Quick Start](../../README.md#quick-start) for installation and environment setup. Run `npm run dev:web` from the repository root to start web at `http://localhost:49100` with the API at `http://localhost:49102`. With an API already running, use `npm --workspace web run dev`. In [the environment template](.env.example), `SITE_URL` sets canonical metadata and `API_INTERNAL_ORIGIN` sets the server-only API origin; both are required in production.

The compiled website template is `blog`, with classic, modern and minimal style presets. Canonical and Open Graph metadata, `/sitemap.xml` and `/robots.txt` use the configured site origin. Private revisions are not public delivery inputs; see the [development guide](../../README.md) for workflow status.

`npm --workspace web run build` does not require database credentials or an available API. Run workspace checks with:

```sh
npm --workspace web run lint
npm --workspace web run typecheck
npm --workspace web test
```
