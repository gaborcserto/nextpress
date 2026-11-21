# Current implementation

Snapshot based on source, tests, configuration, and Prisma models in this repository. “Implemented” means meaningful verification exists; a model or route alone is not proof of an end-to-end workflow. “Partial” means a capability exists with material gaps. Planned and proposed items are not present-day features.

## API and infrastructure

| Area                                      | Status      | Evidence and limits                                                                                                                                         |
| ----------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js API and service/repository layers | Implemented | `apps/api/src/app/api`, `src/lib/services`, `src/lib/repos`; route and service tests. API is not NestJS.                                                    |
| PostgreSQL/Prisma                         | Implemented | `packages/db/prisma/schema.prisma`, committed migrations, schema/config tests. Database-backed integration suites are opt-in and use disposable PostgreSQL. |
| Authentication                            | Implemented | Better Auth in `apps/api/src/lib/auth`; session and account policy tests. OAuth is configuration-dependent.                                                 |
| Authorization                             | Implemented | Server role, ownership, and protected-route checks; `apps/api/src/app/api/content-access.test.ts`. UI visibility is not the security boundary.              |
| Validation/contracts                      | Implemented | Zod validation in API and browser-safe shared contracts in `packages/shared`; OpenAPI validation command exists.                                            |
| Request correlation/logging               | Implemented | `request-logging.server.ts`, shared correlation contracts and tests.                                                                                        |
| Safeguards                                | Implemented | Security headers, rate limiting, safe public content projection, media path checks, and mutation validation have focused tests.                             |
| Configuration and health                  | Partial     | API and DB configuration resolution plus `db:target` exist. Operational health is not a complete deployment/readiness system.                               |

## Admin and editorial workflows

| Area                                     | Status                     | Evidence and limits                                                                                                                                                                                                                            |
| ---------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard, user administration, settings | Implemented                | Admin routes/components and API-backed flows in `apps/admin/src/app`; workspace tests. OAuth/provider settings depend on credentials.                                                                                                          |
| Posts and pages                          | Implemented                | Content screens, API routes, Prisma `Page`, editing and publication metadata; see `apps/admin/src/app` and `apps/api/src/app/api/pages`.                                                                                                       |
| Rich text                                | Implemented                | Slate editor in `apps/admin/src/ui/components/SlateEditor`, with utility and component tests.                                                                                                                                                  |
| Taxonomy                                 | Implemented                | Taxonomy models and API/admin management; current model uses typed taxonomy associations.                                                                                                                                                      |
| Media                                    | Partial                    | The Admin library, local PNG/JPEG workflow, cover selection, ordered galleries, and protected preview use the existing API-backed media model. See [media features](features.md#media).                                                        |
| Page hierarchy                           | Complete                   | Admin parent and sibling-order editing, child listing, and localized nested public URLs are implemented. See the FUNC-04 roadmap for verification status.                                                                                      |
| Legacy revisions                         | Partial                    | `PageRevision` and revision APIs/history exist; recovery and draft continuity remain distinct workflows.                                                                                                                                       |
| Private drafts/autosave/recovery         | Partial, guarded rehearsal | Working aggregate persistence and HTTP paths exist, but private draft admission is off by default and requires independently verified database safeguards. Rehearsal is development/test only. No unattended scheduler exists. See API README. |
| Publishing/scheduling                    | Partial                    | Explicit publication states and guarded pinned scheduled-release execution exist. No automatic scheduler is installed; scheduling is not a generally admitted production workflow.                                                             |
| Navigation and appearance controls       | Partial                    | Settings and menu/appearance forms and API contracts exist. Public template support is bounded; all intended menu placements and empty-menu behavior are not verified end-to-end.                                                              |

## Public Web

| Area                                           | Status      | Evidence and limits                                                                                                                                |
| ---------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage, post archives/details, managed pages | Implemented | App Router pages at `apps/web/src/app`, server content loaders, and route tests.                                                                   |
| Template/preset rendering                      | Partial     | Blog template registry and classic/modern/minimal presets exist. This is not a general-purpose page-builder system.                                |
| Header/footer/navigation                       | Complete    | Database-managed nested Header and Footer menus and the optional Minimal Sidebar are implemented. See the FUNC-04 roadmap for verification status. |
| Search and taxonomy archives                   | Implemented | Search and tag/category routes, query actions, and tests exist. Search is not semantic.                                                            |
| SEO                                            | Implemented | Metadata, sitemap, robots, canonical/Open Graph behavior and tests exist.                                                                          |
| Accessibility/responsive behavior              | Partial     | Semantic controls, skip link, responsive CSS, and focused tests exist; no complete WCAG audit is recorded.                                         |
| Public content isolation                       | Implemented | Web consumes anonymous `/api/public/*`; validation rejects private fields. Requests currently use `no-store`, limiting caching opportunities.      |

## Engineering and readiness

| Area                       | Status         | Evidence and limits                                                                                                                                                                        |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit/component tests       | Implemented    | Vitest and React Testing Library in Admin, API, Web, DB, and shared packages.                                                                                                              |
| Database integration tests | Partial/opt-in | Disposable PostgreSQL integration suites exist; ordinary `npm test` does not provision PostgreSQL.                                                                                         |
| Browser tests              | Partial        | Playwright configuration and `e2e/` flows exist; coverage is not evidence of all user journeys.                                                                                            |
| CI                         | Implemented    | GitHub Actions workflows and workspace checks exist. CI-01 changes are present locally; the recurring Admin PAGE timeout remains unproven. TEST-02 findings are in the local audit report. |
| Build/typecheck/lint       | Implemented    | Root scripts coordinate workspace tasks through Turborepo.                                                                                                                                 |
| Deployment readiness       | Partial        | Environment, build and health-related pieces exist, but production backup/restore operations, durable media, deployment topology, and operational runbooks need validation.                |
| Performance/caching        | Unverified     | No representative capacity benchmark; public web API requests use `no-store`.                                                                                                              |

Detailed future gaps are inventoried in [features](features.md). FUNC-01 will perform the dedicated completeness and structure audit; this snapshot is not that audit.
