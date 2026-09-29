# AGENTS.md

## Purpose

This repository is a Turbo monorepo for NextPress. It contains two Next.js apps and shared workspace packages.

Use this file as the default operating guide for agents working in the repo.

## Workspace Layout

- `apps/web`: public-facing Next.js app
- `apps/admin`: admin Next.js app with auth, content editing, and internal APIs
- `packages/db`: Prisma schema, database client, migrations, and seed logic
- `packages/shared`: shared TypeScript exports
- `packages/eslint-config`: shared lint config

## Tooling Baseline

- Package manager: `npm@10.2.4`
- Workspace runner: Turborepo
- Language: TypeScript
- Frontend: Next.js 16, React 19
- Database: Prisma with PostgreSQL

## Common Commands

Run from the repo root unless a task specifically targets one workspace.

- `npm run dev`: starts all workspace dev servers in parallel
- `npm run dev:web`: starts `apps/web` on `127.0.0.1:49100`
- `npm run dev:admin`: starts `apps/admin` on `127.0.0.1:49101`
- `npm run build`: builds all workspaces through Turbo
- `npm run lint`: runs workspace lint tasks
- `npm run lint:fix`: runs lint with autofix
- `npm run prisma:generate`: generates Prisma client
- `npm run prisma:migrate`: runs Prisma migrations
- `npm run db:up`: starts local services from `docker-compose.yml`
- `npm run bootstrap`: starts Docker services, then runs all dev servers

## Environment Notes

- App-specific environment examples live in `apps/web/.env.example`, `apps/admin/.env.example`, and `packages/db/.env.example`.
- The database package expects Prisma and PostgreSQL to be configured before auth or content features will work.
- Dev servers are pinned to localhost and fixed ports. Do not assume the default Next.js port `3000`.

## Repo Conventions

- Prefer making changes inside the owning workspace instead of adding cross-package coupling.
- Put shared reusable code in `packages/shared` only when it is genuinely shared by multiple workspaces.
- Database schema changes belong in `packages/db/prisma/schema.prisma` and should be paired with the appropriate Prisma workflow.
- Admin UI work should follow the existing split between `src/components`, `src/ui`, `src/lib`, and route handlers under `src/app/api`.
- Validation logic in `apps/admin` is commonly colocated under `src/lib/validation`.

## Testing And Verification

- There is currently no meaningful automated test suite configured at the repo root.
- For most changes, the minimum verification bar is targeted linting plus the narrowest relevant app flow check.
- When modifying Prisma schema or seed logic, validate generation and migration steps if the environment is available.

## Working Agreement

- Check for existing user changes before editing. The worktree may already be dirty.
- Keep edits scoped. Do not refactor unrelated areas while handling a focused task.
- Prefer root scripts over ad hoc workspace commands unless the task is intentionally narrow.
- Document any new required setup in this file or a workspace README when introducing it.
