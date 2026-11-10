# Public web application

The public Next.js UI consumes only anonymous `/api/public/*` delivery endpoints. It has no database or authentication-server dependency. Configure `.env` from `.env.example`: `SITE_URL` controls canonical metadata; `API_INTERNAL_ORIGIN` is the server-only API origin (required in production).

`npm run dev:web` starts API (49102) and web (49100). With an existing compatible API, use `npm --workspace web run dev` instead. `npm --workspace web run build` builds without database credentials or API availability. See [deployment](../../docs/deployment.md) for standalone packaging and runtime configuration.

Requests are uncached, cookie-free, validated against shared schemas and bounded by a ten-second timeout. Detail 404s map to not-found; upstream failures propagate to the existing error boundaries. API owns publication filtering, defaults and safe projections. No Prisma fallback or persistent content cache exists.
