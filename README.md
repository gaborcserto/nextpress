# NextPress

NextPress is a PostgreSQL-backed headless CMS with separate API, administration, and public website applications.

## Features

- Administer posts, pages, taxonomy, users, and site settings.
- Deliver published content to a public website through anonymous API endpoints.
- Edit rich content, manage media, review revisions, and configure SEO metadata.
- Generate sitemaps and render pages using configurable appearance and post-list templates.

## Stack and workspaces

The repository uses TypeScript, Next.js, React, Better Auth, Prisma, PostgreSQL, Zod, npm workspaces, and Turborepo.

| Path | Purpose |
| --- | --- |
| `apps/api` | Authentication, API routes, validation, and database access |
| `apps/admin` | Authenticated CMS interface |
| `apps/web` | Public website |
| `packages/db` | Prisma schema, migrations, and database client |
| `packages/shared` | Shared contracts and content types |
| `packages/eslint-config` | Shared application lint configuration |

## Getting started

Requirements: Node.js 24.x (pinned to 24.22.2 in `.nvmrc`), npm 12.2.2, and Docker for local PostgreSQL.

1. Install npm 12.2.2 if needed, then run `npm ci` at the repository root.
2. Copy each `.env.example` to `.env` in `apps/api`, `apps/admin`, `apps/web`, and `packages/db`. Set local database values and `POSTGRES_VOLUME_NAME` as needed in the root `.env`.
3. Start PostgreSQL with `npm run db:up`, then run `npm run prisma:generate` and `npm run prisma:migrate`.
4. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `apps/api/.env` and run `npm run admin:bootstrap`. No administrator is created by default; passwords must be at least 15 characters.
5. Start the applications with `npm run dev`.

The admin, public website, and API use ports 49101, 49100, and 49102 respectively. Admin and web read the API origin from `API_INTERNAL_ORIGIN`; API and database use `DATABASE_URL`.

## Development and testing

- `npm run dev:api`, `npm run dev:admin`, and `npm run dev:web` start one application with its API dependency.
- `npm run build`, `npm run lint`, and `npm run typecheck` run repository checks.
- `npm test` runs workspace tests; `npm run test:e2e` runs Playwright browser tests against a disposable PostgreSQL database. Install Chromium with `npx playwright install chromium` first.
- `npm run check:changed` checks affected workspaces for local changes.

The API enforces session authentication and server-side authorization. Public endpoints serve published content; editorial and preview operations require authentication.
