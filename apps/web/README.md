# Web

The `web` workspace renders public pages and posts using the API's anonymous `/api/public/*` endpoints. It has no database connection or authentication server. Requests are uncached and use a ten-second timeout; missing content maps to not-found and other upstream failures reach the app error boundaries.

Run `npm run dev:web` from the repository root to start web at `http://localhost:49100` with the API at `http://localhost:49102`. With an API already running, use `npm --workspace web run dev`. Copy `apps/web/.env.example` to `apps/web/.env`; `SITE_URL` sets canonical metadata and `API_INTERNAL_ORIGIN` sets the server-only API origin (required in production).

`npm --workspace web run build` does not require database credentials or an available API. Run workspace checks with:

```sh
npm --workspace web run lint
npm --workspace web run typecheck
npm --workspace web test
```
