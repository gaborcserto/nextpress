# Roadmap

Phase status is based on repository evidence and user-confirmed outcomes. This is a sequence, not a promise of dates. Audit phases produce findings; they do not authorize implementation by themselves.

| Phase            | Objective and deliverables                                             | Status / dependencies                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01A          | Security logging and request correlation                               | Completed; see [current state](current-state.md) and `packages/shared/src/request-correlation.ts`, API logging tests. Limitations: logs/correlation do not replace monitoring or tracing.    |
| QUAL-01B         | Code quality and correctness improvements                              | Completed per `.notes/audits/nextpress-qual-01b-implementation.md`; root/workspace quality policy and checks are present.                                                                    |
| ENV-01 / ENV-01B | Consolidate development environment and authoritative DB configuration | Completed per `.notes/audits/nextpress-env-01-implementation.md` and `nextpress-env-01b-implementation.md`; API `.env` is normal source, process overrides win, DB target inspection exists. |
| README-01        | Root README cleanup                                                    | Completed; concise intro, architecture, working Quick Start, and workspace guide links remain.                                                                                               |
| TEST-01          | Test stability and CI reliability                                      | Completed. Test details below; GitHub Actions success is user-confirmed, not independently queried here.                                                                                     |
| DOC-01           | Project documentation, vision, and development tracking                | Current; this documentation set.                                                                                                                                                             |
| CI-01            | Reduce unnecessary CI time without weakening validation                | Next; depends on baseline measurement.                                                                                                                                                       |
| FUNC-01          | Functional completeness and repository structure audit                 | Planned after CI-01; audit-only.                                                                                                                                                             |
| DS-01            | Admin and Public Web design-system audit                               | Planned after FUNC-01.                                                                                                                                                                       |
| FUNC-02          | Implement prioritized functional gaps                                  | Planned after audit findings and scope/priorities.                                                                                                                                           |

## TEST-01 evidence

The local report `.notes/audits/nextpress-test-stability-report.md` records a fix to asynchronous test synchronization and fake-timer interaction in `PrivateDraftBoundary` tests while preserving assertions and application behavior. It reports 430 Admin tests passed locally, three Admin V8 coverage runs, full Admin tests/lint/typecheck, and full monorepo `npm test` (with some Turbo cache reuse). GitHub Actions passing was subsequently confirmed by the user. These statements distinguish local report evidence from hosted CI confirmation; this document does not claim every suite was independently rerun uncached.

## CI-01 scope

Recent GitHub Actions runs were reported at approximately 6–9 minutes. Measure end-to-end and task-level durations, Turborepo cache behavior and `--force`, GitHub Actions dependency caching, duplicate build/test work, Vitest workers, test/coverage parallelism, matrix runners for Admin/API/Web/shared where justified, affected-workspace execution, resource contention and stability, and cache invalidation. Record before/after measurements.

Aim for roughly 3–5 minutes on typical changes as an optimization target, not a guarantee. Preserve required lint, typecheck, unit/integration tests, coverage requirements, builds, security checks, and appropriate full-repository verification. No CI optimization is part of DOC-01.

## FUNC-01 scope

Audit functional completeness across Admin, API, Public Web, DB, and shared contracts. Separately review directory organization, feature boundaries, screens/forms, reusable components, hooks, services, types/constants, public exports and deep imports, circular dependencies, component responsibilities, test placement, Next.js server/client boundaries, and workspace ownership. Use `.references/` as supporting material. Do not prescribe one folder per component or mandatory barrels. Separate functional gaps from structural code-quality issues. FUNC-01 is audit-only.

## DS-01 scope

Audit Admin and Public Web tokens/colors, typography, spacing, buttons, forms, icons, navigation, tables/responsive lists, dropdowns/dialogs, sticky header actions, mobile profile menus, content metadata, accessibility, responsive behavior, and public template consistency. Admin should feel modern, professional, and distinctive without becoming overly industrial or minimal. Preserve meaningful visual differences among public templates.
