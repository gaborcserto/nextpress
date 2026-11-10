# NextPress

## Overview

NextPress is a modular, PostgreSQL-backed headless content management system. It separates the backend API, authenticated administration interface and public website so each application has a clear role and can be developed independently.

## Features

- **Implemented:** authenticated content administration for posts, pages, taxonomy, users and settings; public content delivery; versioned rich content; media handling; SEO metadata and sitemap support.
- **Partial:** page composition foundations support validated blocks, working revisions, preview and publishing. The editor is a minimum JSON-based workflow, not a drag-and-drop builder. Appearance and post-list templates provide basic rendering, not a complete theme system.
- **Planned:** complete page and site templates, backend presets, and AI-assisted site creation.

## Architecture

- `apps/api` owns authentication, authorization, validation, business rules, OpenAPI and database access.
- `apps/admin` is the authenticated CMS interface and communicates with the API over HTTP.
- `apps/web` renders the public site using anonymous content-delivery endpoints; it does not connect to the database.
- `packages/db` owns Prisma and PostgreSQL persistence. `packages/shared` contains portable contracts and content types. Shared tooling is maintained in workspace configuration and `packages/eslint-config`.

## Technology Stack

TypeScript, Next.js, React, Node.js, Better Auth, Prisma, PostgreSQL, Zod, npm workspaces, Turborepo and Playwright.

## Repository Structure

| Path                     | Responsibility                                               |
| ------------------------ | ------------------------------------------------------------ |
| `apps/api`               | Backend API and authentication                               |
| `apps/admin`             | Administration frontend                                      |
| `apps/web`               | Public frontend                                              |
| `packages/db`            | Prisma schema, migrations and database package               |
| `packages/shared`        | Cross-workspace contracts and types                          |
| `packages/eslint-config` | Shared application lint configuration                        |
| `docs`                   | Maintained setup, architecture and operational documentation |

## Getting Started

Requirements: Node.js 24.x (the repository pins 24.22.2 in `.nvmrc`), npm 12.2.2 and Docker for the local PostgreSQL service.

1. Install the pinned npm version if needed (`npm install --global npm@12.2.2`), then run `npm ci` at the repository root.
2. Copy `.env.example` to `.env` for `apps/api`, `apps/admin`, `apps/web` and `packages/db`. Configure the root Compose environment and PostgreSQL volume as described in [PostgreSQL setup](docs/postgresql.md). Keep local credentials private.
3. Start PostgreSQL with `npm run db:up`, then generate Prisma and apply development migrations with `npm run prisma:generate` and `npm run prisma:migrate`.
4. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `apps/api/.env` and run `npm run admin:bootstrap`. No default administrator is created; passwords must be at least 15 characters.
5. Start all applications with `npm run dev`.

The admin UI is at [localhost:49101](http://localhost:49101), the public site at [localhost:49100](http://localhost:49100), and the API at [localhost:49102](http://localhost:49102). The API and database use `DATABASE_URL`; admin and web use the server-side `API_INTERNAL_ORIGIN` setting. See [backend boundaries](docs/backend-boundaries.md) for deployment topology and limits.

## Development & Testing

| Command                                                     | Purpose                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`                                               | Start API, admin and web                                                         |
| `npm run dev:api` / `npm run dev:admin` / `npm run dev:web` | Start an individual app with its required API dependency                         |
| `npm run build`                                             | Build all workspaces                                                             |
| `npm run lint` / `npm run typecheck`                        | Run lint and type checks                                                         |
| `npm run check:changed`                                     | Check affected workspaces for local changes                                      |
| `npm test`                                                  | Run workspace tests                                                              |
| `npm run test:e2e`                                          | Run Playwright browser tests against disposable PostgreSQL and local app servers |

Install Playwright Chromium with `npx playwright install chromium` before E2E runs. The E2E runner provisions and removes its own test database; it is separate from ordinary unit tests. See [CMS foundations](docs/cms-foundations.md) for setup and scope. Application-specific instructions are in the [API](apps/api/README.md), [admin](apps/admin/README.md) and [web](apps/web/README.md) READMEs.

## Security

The API enforces session-based authentication and server-side authorization. Public delivery exposes published content through bounded, cookie-free API endpoints, while editorial and preview operations remain protected. These are security foundations, not a production-readiness claim: deployment still requires appropriate HTTPS ingress, trusted proxy configuration, protected audit retention, rate limiting strategy and backup/restore procedures. See [deployment guidance](docs/deployment.md) and [CMS security and production gates](docs/cms-foundations.md).

## Roadmap

Complete the page and appearance template system, expand backend presets, and explore AI-assisted site creation. Composition, revisions, preview and media are partial foundations; production deployment and security acceptance also have outstanding operational gates.

## Documentation

- [PostgreSQL setup and persistence safety](docs/postgresql.md)
- [Backend boundaries and API compatibility](docs/backend-boundaries.md)
- [Deployment](docs/deployment.md)
- [CMS foundations, limitations and production gates](docs/cms-foundations.md)
- [API](apps/api/README.md) · [Admin](apps/admin/README.md) · [Web](apps/web/README.md)
