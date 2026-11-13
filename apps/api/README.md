# API

The `api` workspace owns Better Auth, authorization, API routes, validation, business rules, and database access. Run `npm run dev:api` from the repository root; it listens on `http://localhost:49102`.

Copy `apps/api/.env.example` to `apps/api/.env`. The API needs `DATABASE_URL`, `BETTER_AUTH_URL`, and a unique `BETTER_AUTH_SECRET` of at least 32 characters. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for `npm run admin:bootstrap`. OAuth providers are enabled only when both credentials are configured.

The OpenAPI document is available at `/api/openapi`; the interactive API reference is served by the admin application at `/api-docs` in development. Validate the document and route coverage with `npm run openapi:validate` from the repository root.

Useful workspace commands:

```sh
npm --workspace api run build
npm --workspace api start
npm --workspace api test
npm --workspace api run typecheck
```

Generate Prisma before building directly. `npm run prisma:generate` from the root performs this step.
