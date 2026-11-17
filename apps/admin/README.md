# Admin

The `admin` workspace is the authenticated CMS interface. It includes content, taxonomy, user, settings, profile, and session screens, and forwards browser API requests to the API workspace.

Follow the repository [Quick Start](../../README.md#quick-start) for installation and environment setup. Run `npm run dev:admin` from the repository root to start admin at `http://localhost:49101` with the API at `http://localhost:49102`. For admin alone, use `npm --workspace admin run dev` while a compatible API is running. `API_INTERNAL_ORIGIN` in [the environment template](.env.example) selects the API server.

The ordinary editor uses the legacy publication workflow. Private editing and autosave require separate rehearsal admission and remain disabled in production; see the [development guide](../../README.md). An unsuccessful private command does not silently fall back to a live save.

In development, the API reference is available at `/api-docs` and the OpenAPI JSON at `/api/openapi`. The health dashboard at `/health` checks API liveness through `/api/health`; that endpoint does not check database readiness.

Run workspace checks with:

```sh
npm --workspace admin run lint
npm --workspace admin run typecheck
npm --workspace admin test
```
