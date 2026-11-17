# NextPress

NextPress is a PostgreSQL-backed headless CMS with separate API, administration and public website applications. It manages pages and posts and delivers published content through an anonymous HTTP API.

## Features

- Page and post editing with rich content, taxonomy and legacy revision history.
- PNG/JPEG uploads, a media library and reference-aware deletion checks.
- Session authentication and server-side role and ownership checks through Better Auth.
- User administration, site settings, navigation and website appearance controls.
- A public blog template with classic, modern and minimal presets, search and tag archives.
- Canonical and Open Graph metadata, sitemap and robots routes.
- A development-only OpenAPI document and interactive API reference.

Private drafts, autosave and restoration are rehearsal-only. The private draft rehearsal does not support publishing, unpublishing or scheduled release.

## Architecture

The npm workspace monorepo uses Turborepo to coordinate these applications and packages:

- [`apps/api`](apps/api/README.md): authoritative authentication, authorization, validation, content services and database access.
- [`apps/admin`](apps/admin/README.md): authenticated CMS interface; browser API calls are forwarded to the API on the same origin.
- [`apps/web`](apps/web/README.md): public website consuming `/api/public/*` through server-side HTTP requests, without database credentials.
- [`packages/db`](packages/db): Prisma schema, migrations, client and seed code.
- [`packages/shared`](packages/shared): shared validation contracts, content types and browser-safe schemas.
- [`packages/eslint-config`](packages/eslint-config): shared application lint rules.

The existing Page projection remains authoritative for public delivery. Public content must be published with a non-null publication time that is due. Private revisions are not public-reader inputs; web API requests currently use `no-store`.

## Tech stack

TypeScript, Next.js App Router, React, Better Auth, Prisma, PostgreSQL and Zod. The admin uses Slate, Tailwind CSS and daisyUI. Verification uses ESLint, Oxfmt, Vitest, React Testing Library and Playwright.

## Quick start

Use Node.js 24.x ([`.nvmrc`](.nvmrc) pins 24.22.2), npm 12.2.2 and Docker with Compose for local PostgreSQL 18. Run commands from the repository root unless stated otherwise.

1. Clone and install:

   ```sh
   git clone https://github.com/gaborcserto/nextpress.git
   cd nextpress
   npm ci
   ```

2. Copy the environment templates, then edit the copies:

   ```sh
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/admin/.env.example apps/admin/.env
   cp apps/web/.env.example apps/web/.env
   cp packages/db/.env.example packages/db/.env
   ```

   In `apps/api/.env`, set a unique `BETTER_AUTH_SECRET` of at least 32 characters, `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least 15 characters. Clear unused OAuth credential placeholders; providers also require enabling in settings. Keep the template localhost origins for local development. API and database `DATABASE_URL` values must point to the same local database; admin and web use `API_INTERNAL_ORIGIN`. Leave private-draft rehearsal and backfill variables unset.

3. For a **fresh installation**, choose an unused Docker volume name, for example `nextpress_local_pg18`, and set `POSTGRES_VOLUME_NAME` in the root `.env` to that name. Compose requires this external volume to exist:

   ```sh
   docker volume create nextpress_local_pg18
   npm run db:up
   docker compose exec db pg_isready -U postgres -d cms
   ```

   Wait for PostgreSQL to accept connections before continuing. Existing installations must identify and retain their current PostgreSQL 18 parent volume; do not substitute a fresh volume or reuse a volume from another PostgreSQL major version. Compose binds the database to `127.0.0.1:5432`.

4. Generate the client, apply committed migrations and create the administrator:

   ```sh
   npm run prisma:generate
   npm run prisma:deploy
   npm run admin:bootstrap
   ```

   Bootstrap creates required roles and settings without demo content. It preserves an existing account password on rerun. Use `npm run prisma:migrate` only when intentionally developing a schema migration; normal setup applies the committed chain with `prisma:deploy`. Do not reset an existing database to resolve migration errors.

5. Start all applications:

   ```sh
   npm run dev
   ```

   Open the [admin sign-in](http://localhost:49101/auth/sign-in), [public website](http://localhost:49100) or [API health endpoint](http://localhost:49102/api/health). A fresh database has no published pages or posts. Health reports API liveness, not database readiness.

These steps describe local development, not production provisioning. Environment templates contain local example credentials; keep real `.env` files out of Git.

## Documentation

See the [development guide](docs/development.md) and [workspace guides](apps/api/README.md).
