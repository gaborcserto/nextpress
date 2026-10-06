# NextPress

NextPress is an npm workspace monorepo for a Next.js content-management project. The current implementation is centered on the authenticated admin application and its PostgreSQL-backed content and settings foundation. The public web application is still the default Next.js starter page; it does not yet render the CMS content.

## Repository structure

- `apps/admin` - authenticated administration application, admin UI, Better Auth integration, and API route handlers for content, taxonomy, users, and settings.
- `apps/web` - public-facing Next.js application. It currently contains the starter home page.
- `packages/db` - Prisma schema, migrations, generated client integration, seed logic, and database helpers for PostgreSQL.
- `packages/shared` - shared TypeScript exports and utilities.
- `packages/eslint-config` - shared ESLint flat configuration used by the workspaces.

## Stack

The repository uses Node.js 22, npm 10.2.4, TypeScript 5.9, Next.js 16, React 19, Turborepo 2, Prisma 7, and PostgreSQL. Tests use Vitest 4 with React Testing Library where UI rendering is involved. ESLint 9 provides linting, with Husky and lint-staged running staged-file checks before commits.

## Local development

Requirements: Node.js 22.x, npm 10.2.4, and Docker for the local PostgreSQL service.

Install dependencies from the repository root:

```bash
npm ci
```

Copy the example environment files to local environment files in their existing locations:

- `apps/admin/.env.example` -> `apps/admin/.env`
- `apps/web/.env.example` -> `apps/web/.env`
- `packages/db/.env.example` -> `packages/db/.env`

Replace example credentials and OAuth placeholders with local values where needed. The admin and database examples use the local PostgreSQL database created by the repository's Docker Compose configuration.

Generate Prisma Client before using database-backed flows:

```bash
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run admin:bootstrap
npm run db:seed
```

`db:seed` creates editable development posts, pages, and tags using `packages/db/.env`. It requires `DATABASE_URL` and `ALLOW_DEVELOPMENT_CONTENT_SEED=true`, is restricted to local PostgreSQL databases named `cms` or `nextpress_dev_verify_` followed by lowercase letters, digits, or underscores, and always rejects `NODE_ENV=production`. Reruns update seed-owned records using stable IDs and slugs; they never reset the database or replace unrelated records. Authors are optional, so no administrator credentials are needed.

To provision the initial administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `apps/admin/.env`, then run `npm run admin:bootstrap`. This separate command loads only the admin environment and ensures roles, site settings, and the administrator's credential account. Existing password hashes and settings are preserved. Each workspace keeps its own `DATABASE_URL`: the database package for Prisma and content seeding, and each application for its runtime. Point them at the same local database for development.

Start both applications with:

```bash
npm run dev
```

The configured development URLs are [admin](http://127.0.0.1:49101) and [web](http://127.0.0.1:49100). They can also be started separately with `npm run dev:admin` and `npm run dev:web`.

## Useful commands

```bash
npm run dev             # Run the workspace development servers
npm run dev:web         # Run the public app on port 49100
npm run dev:admin       # Run the admin app on port 49101
npm run build           # Build all workspaces
npm run lint            # Lint all configured workspaces
npm run lint:fix        # Apply ESLint fixes
npm run typecheck       # Typecheck supported workspaces
npm test                # Run all test suites
npm run coverage        # Run tests with V8 coverage
npm run prisma:generate # Generate Prisma Client
npm run prisma:migrate  # Run the database migration workflow
npm run db:up           # Start PostgreSQL with Docker Compose
npm run db:seed         # Add or update local development content
npm run admin:bootstrap # Provision the explicitly configured administrator
npm run bootstrap       # Start PostgreSQL, then both development servers
```

The database package also exposes `validate`, `format`, and `seed` scripts; run them through the workspace when needed, for example `npm --workspace @nextpress/db run validate`.

## Testing

Tests are organized beside the implementation in the applications and packages and run with Vitest. The suites cover admin unit, component, validation, and API route behavior, along with focused tests in the web, database, and shared packages. CI runs the affected workspace suites with coverage; there is no end-to-end test suite in the repository.

Run the suites with `npm test` or collect V8 coverage with `npm run coverage`.

## Authentication and admin foundation

The [HTTP API guide](docs/api.md) explains the OpenAPI contract and its maintenance workflow.
Development-only [API docs](http://127.0.0.1:49101/api-docs)
and [OpenAPI JSON](http://127.0.0.1:49101/api/openapi) share a schema-derived contract;
run `npm run openapi:validate` to check it. Public `GET /api/health` confirms
application liveness without checking PostgreSQL.

The admin application provides email/password authentication, optional configured social providers, session handling through Better Auth, and role-aware server-side authorization. The supported roles are ADMIN, EDITOR, AUTHOR, and SUBSCRIBER. Admin screens currently cover dashboard, pages, posts, taxonomy, users, settings, and profile/session information. Profile editing and account management are not implemented.

## Repository automation

GitHub Actions validates pull requests and pushes to `master` with dependency installation, Prisma generation, linting, typechecking, tests with coverage, and builds. Workflow concurrency cancels superseded runs. A separate CodeQL workflow analyzes JavaScript and TypeScript on pull requests, pushes to `master`, and weekly on a schedule. Dependabot checks npm and GitHub Actions dependencies monthly. Husky invokes lint-staged for staged JavaScript and TypeScript files.

Environment files are intentionally ignored by Git; use the checked-in `.env.example` files as the source for local configuration. Do not commit real credentials.
