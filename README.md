# NextPress

NextPress is an npm workspace monorepo for a PostgreSQL-backed content management system, with an authenticated admin app and a public Next.js site.

## Repository structure

- `apps/admin` — administration UI, authentication, and API routes.
- `apps/web` — public site for published content.
- `packages/db` — Prisma schema, client, migrations, and database helpers.
- `packages/shared` — cross-workspace TypeScript exports.
- `packages/eslint-config` — shared ESLint configuration.

## Quick start

Requirements: Node.js 22.x, npm 10.2.4, and Docker for local PostgreSQL.

1. Run `npm ci` at the repository root.
2. Copy each `.env.example` to `.env` in `apps/admin`, `apps/web`, and `packages/db`; set local values and keep credentials private.
3. Run `npm run db:up`, `npm run prisma:generate`, and `npm run prisma:migrate`.
4. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `apps/admin/.env`, then run `npm run admin:bootstrap`. There is no default account; new passwords must be at least 15 characters.
5. Optionally run `npm run db:seed` for development content. It requires `ALLOW_DEVELOPMENT_CONTENT_SEED=true` and rejects production execution.
6. Run `npm run dev` to start both apps.

The admin app runs at [localhost:49101](http://localhost:49101); the public site runs at [localhost:49100](http://localhost:49100). Each workspace uses its own `DATABASE_URL`; point them at the same local database.

## Essential commands

| Command | Purpose |
| --- | --- |
| `npm run dev:admin` / `npm run dev:web` | Start one application |
| `npm run build` | Build all workspaces |
| `npm run lint` / `npm run typecheck` | Check code quality and types |
| `npm test` / `npm run coverage` | Run tests / tests with coverage |
| `npm run openapi:validate` | Validate the admin OpenAPI contract and route coverage |

See the [admin README](apps/admin/README.md), [web README](apps/web/README.md), and [agent resources](.agents/README.md) for focused guidance. The [API contracts skill](.agents/skills/nextpress-api-contracts/SKILL.md) describes the API maintenance workflow. Environment templates are the source for configuration; never commit real credentials.
