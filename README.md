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

Private drafts, autosave and restoration are rehearsal-only. The guarded private draft rehearsal supports publishing, unpublishing and pinned scheduled release. Production admission remains disabled; no unattended scheduler is installed.

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

Use Node.js 24.x ([`.nvmrc`](.nvmrc)), npm 12.2.2 and Docker with Compose for local PostgreSQL 18. Run commands from the repository root.

1. Clone and install:

   ```sh
   git clone https://github.com/gaborcserto/nextpress.git
   cd nextpress
   npm ci
   ```

2. On a fresh checkout, copy the templates below to `.env` in their respective directories (`cp` in Bash or `Copy-Item` in PowerShell). Keep existing files when returning to a checkout.

   - [Root, for Docker Compose](.env.example)
   - [API](apps/api/.env.example)
   - [Admin](apps/admin/.env.example)
   - [Web](apps/web/.env.example)

   In `apps/api/.env`, set `DATABASE_URL`, a unique `BETTER_AUTH_SECRET` of at least 32 characters, `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least 15 characters. Generate a secret locally with `node -p "require('node:crypto').randomBytes(32).toString('base64url')"`. Keep real environment files and secrets out of Git.

3. For a **fresh installation**, choose a new Docker volume name and set it as `POSTGRES_VOLUME_NAME` in the root `.env`. Create the volume and start PostgreSQL:

   ```sh
   docker volume create nextpress-local
   npm run db:up
   ```

   The API template's `DATABASE_URL` targets the local Compose database. Do not point setup commands at a database containing data you need to preserve.

4. Generate the client, apply committed migrations and create the administrator:

   ```sh
   npm run prisma:generate
   npm run prisma:deploy
   npm run admin:bootstrap
   ```

   Bootstrap creates the administrator and required settings. It preserves an existing account password on rerun.

5. Start all applications:

   ```sh
   npm run dev
   ```

   Open the [Admin sign-in](http://localhost:49101/auth/sign-in) and [public website](http://localhost:49100). A fresh database has no published pages or posts.

## Documentation

Start with the [project documentation index](docs/README.md) for product vision, verified current state, features, roadmap, architecture, development, deployment, and decisions. Workspace-specific guides: [API](apps/api/README.md), [Admin](apps/admin/README.md), and [Public Web](apps/web/README.md).
