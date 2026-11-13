# Admin

The `admin` workspace is the authenticated CMS interface. It includes content, taxonomy, user, settings, profile, and session screens, and forwards browser API requests to the API workspace.

Run `npm run dev:admin` from the repository root to start admin at `http://localhost:49101` with the API at `http://localhost:49102`. For admin alone, use `npm --workspace admin run dev` while a compatible API is running. Copy `apps/admin/.env.example` to `apps/admin/.env`; configure `API_INTERNAL_ORIGIN` for the API server.

In development, the API reference is available at `/api-docs` and the OpenAPI JSON at `/api/openapi`. The health dashboard at `/health` checks API liveness through `/api/health`; that endpoint does not check database readiness.

Run workspace checks with:

```sh
npm --workspace admin run lint
npm --workspace admin run typecheck
npm --workspace admin test
```
