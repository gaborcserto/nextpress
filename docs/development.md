# Development

Commands below are rooted in the repository scripts and current Quick Start. Use Node.js 24.x (`.nvmrc`), npm 12.2.2, and Docker Compose with PostgreSQL 18 for the standard local setup.

## Setup

1. Install with `npm ci`.
2. Copy `.env.example`, `apps/api/.env.example`, `apps/admin/.env.example`, and `apps/web/.env.example` to the corresponding `.env` files when needed. Keep secrets local. Set a unique `BETTER_AUTH_SECRET` (at least 32 characters), administrator bootstrap credentials, and local `DATABASE_URL` in `apps/api/.env`.
3. For a fresh local database, set a new `POSTGRES_VOLUME_NAME` in root `.env`, create it, then run `npm run db:up`. Root Compose configuration is separate from API-owned database environment resolution.
4. Verify the selected DB with `npm run db:target` before database operations. API `.env` is the normal authoritative `DATABASE_URL`; explicit process-level overrides take precedence.
5. Run `npm run prisma:generate`, `npm run prisma:deploy`, then `npm run admin:bootstrap`.
6. Start with `npm run dev`. Admin is at port 49101, Public Web at 49100, and API at 49102. `npm run dev:admin` and `npm run dev:web` start the respective app with API.

Do not run migrations/bootstrap against a database containing data you need to preserve. Bootstrap preserves an existing administrator password on rerun.

## Useful checks

```sh
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
npm run prisma:validate
npm run openapi:validate
```

`npm test` does not provision PostgreSQL. API database integration suites are opt-in and use disposable local PostgreSQL through guarded runners; do not point them at development/shared/production data. Run workspace checks with `npm --workspace api run lint`, `npm --workspace admin run lint`, or the relevant workspace `test`/`typecheck` scripts.

For task-scoped work, format changed files with `npm run format:changed`, then use `npm run check:changed`. When unrelated working-tree edits exist, pass explicit `-- --files path...` to formatting/check tools as documented by the root agent guide. Do not stage or alter another user's work to validate it.

## Troubleshooting

- Wrong database target: inspect with `npm run db:target`; check process overrides before editing API `.env`.
- Missing Prisma client: run `npm run prisma:generate` before direct DB/API builds.
- Authentication bootstrap failure: check API URL/origin settings and local secret/credentials; never paste secrets into logs or docs.
- Missing published public content on a fresh DB is expected until content is created and published.
- Keep media storage (`MEDIA_STORAGE_ROOT` or API `.media`) outside `public/`; local media needs backup alongside the database.

See workspace READMEs for API-only integration guidance and API reference behavior.
