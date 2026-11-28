# NextPress agent guide

For significant work, consult the [project documentation index](docs/README.md) and the relevant architecture, feature, development, or deployment guide. Keep tracked documentation aligned with verified behavior: update feature status after implementation is completed and tested, roadmap phases when completed or reprioritized, and development/deployment guidance when commands or configuration change. Record significant architectural decisions in `docs/decisions/`. Keep documentation proportionate; trivial edits do not require doc churn. `.notes/` remains local development working material and `.references/` remains supporting reference material; do not automatically publish either. Never include credentials, machine-specific private paths, or environment-specific identifiers in tracked docs.

This file is the repository-level source of truth for coding agents. Read it before changing files, preserve unrelated user work, and keep changes limited to the requested work. Discover applicable skills through [.agents/README.md](.agents/README.md) before implementation. Readability is mandatory for maintained JavaScript/TypeScript/JSX/TSX source edits; load other resources when their scope applies.

## Repository map

NextPress is an npm workspace monorepo run with Turborepo:

- `apps/web`: public-facing Next.js application.
- `apps/api`: authoritative Node.js Next.js backend, Better Auth, API routes, validation, services and repositories.
- `apps/admin`: authenticated administration UI consuming the API through same-origin HTTP forwarding.
- `packages/db`: Prisma schema, generated client integration, migrations, seed logic, and database package code.
- `packages/shared`: genuinely cross-workspace TypeScript exports.
- `packages/eslint-config`: shared flat ESLint configuration for the Next.js applications.

All three applications are first-class. Keep code in its owning workspace, and do not assume that an admin pattern also belongs in the public application. Add to `packages/shared` only when more than one workspace needs the same abstraction.

Admin-specific: keep admin UI organized with the existing `src/components`, `src/ui`, `src/lib`, and `src/app/api` split. API validation commonly lives in `apps/api/src/lib/validation`; follow a nearby implementation before adding another location.

Apply the responsibility-based structural conventions in [.agents/skills/nextpress-readability/references/source-conventions.md](.agents/skills/nextpress-readability/references/source-conventions.md) to new code and substantially modified modules. During dedicated structural reviews or refactors, evaluate in-scope existing code by its actual responsibilities; legacy structure is not exempt. Keep ordinary feature changes scoped to directly related structural corrections. React work also follows [.agents/skills/nextpress-react/SKILL.md](.agents/skills/nextpress-react/SKILL.md).

The database package owns `packages/db/prisma/schema.prisma`, migrations, seed logic, and the Prisma client. Do not edit generated output. Do not change the schema or migrations unless the task explicitly requires a database change and includes the appropriate Prisma workflow.

For local editorial database migrations, Prisma CLI reads the dedicated ignored `packages/db/.env.migrator` configuration; keep the API runtime URL in `apps/api/.env` on `nextpress_dev_api`. Verify runtime and migration targets separately with `npm run db:target` and `npm run db:migration-target` before deployment. Never grant the runtime role access to `_prisma_migrations` or deploy as the local provisioner. See `docs/development.md` for credential setup and recovery.

## Documentation placement

- Tracked project documentation in `docs/` records approved architecture, development, operational guidance and roadmap information. Keep it aligned with verified behavior.
- Future public-facing product documentation belongs in `docs/` when that documentation is authored; distinguish it clearly from internal engineering guidance.
- Private audits, security findings, investigations, research, planning and implementation records belong under ignored `.notes/`; never publish them by copying them into tracked docs.
- External supporting material belongs in `.references/` and is not automatically published.
- `.agents/` contains maintained agent instructions, skills and workflows.
- `scripts/`: executable development and repository maintenance utilities.

Keep private working material for architecture, development, planning, infrastructure, and code quality in `.notes/`; approved project guidance belongs in `docs/`.

## Native-first development

Before implementing custom functionality or adding a dependency, check the installed Next.js, React, Node.js, and modern Web Platform capabilities against version-specific official documentation. Prefer stable, officially supported capabilities that meet functional, architectural, security, accessibility, and performance requirements. Keep custom code where domain behavior, security, portability, or missing capabilities justify it. Avoid speculative abstractions and experimental APIs for convenience.

Preserve API, Admin, and Public Web boundaries and self-hosted operation without Vercel, a CDN, or a cloud provider. Document significant deviations from native capabilities. NATIVE-01 owns the separate project-wide audit.

For technology decisions, check official documentation for the installed versions and verify package/runtime facts against manifests, lockfiles and local types. Prefer native or first-party capabilities when they meet the concrete need; add dependencies only with evidence of incremental value and fit with the owning workspace.

API Route Handlers own authoritative validation of untrusted inputs and server-side authorization. Keep each schema with its owning boundary; share only actual cross-workspace contracts. Document behavior changes in OpenAPI and preserve stable error contracts. Validation does not replace authentication, authorization, database constraints, transactions, rate limits or body/resource limits.

## Grounded implementation

Before implementing:

1. Check `git status` and inspect the relevant diff so existing user work is preserved.
2. Inspect the target files and search for existing components, services, validation schemas, repository methods, route handlers, and shared types.
3. Verify paths, package scripts, configuration, and runtime assumptions in the repository. Do not invent APIs, routes, fields, environment variables, dependencies, or abstractions.
4. Follow an existing good pattern when it fits; if the pattern is unsafe, obsolete, incorrectly typed, or inconsistent, fix the underlying issue rather than copying it.

Prefer a small, direct change with readable control flow. Avoid speculative refactors and cross-package coupling.
Existing staged or unstaged changes are expected context, not a blocker. Build on them incrementally; never reset, restore, stash, or overwrite existing work. Stop only when a concrete technical blocker prevents safe progress.
Preserve existing behavior unless the task intentionally changes it, and make that behavior change explicit in tests and the final report.

## TypeScript and data flow

- Preserve the strict TypeScript baseline in `tsconfig.base.json`; never weaken compiler or ESLint settings to make a change compile.
- Prefer domain types, inferred types where readable, schema-derived types, Prisma-generated types, and library-provided types.
- Narrow `unknown` at boundaries. Avoid `any`, unsafe casts, unnecessary `as`, `@ts-ignore`, and unnecessary non-null assertions.
- Reuse existing types and schemas instead of duplicating interfaces or validation rules.
- Treat request bodies, query parameters, form values, URL values, uploaded content, and external responses as untrusted. Validate them at the appropriate boundary; use the existing Zod validation and error-handling patterns in API where applicable.
- Keep client and server responsibilities clear in Next.js. Do not import server-only database, secret, or authentication code into client components.

## Security

- Authentication and authorization are different responsibilities. Enforce authorization on the server for every protected operation.
- API-specific: preserve the existing Better Auth/session boundaries and reuse server auth helpers such as `withAuth` and role checks rather than relying on hidden UI controls or client-provided roles.
- Never expose secrets, credentials, tokens, session secrets, OAuth secrets, database URLs, or other sensitive environment values to client code or logs. Keep real `.env` files out of Git; update only `.env.example` when documenting required variables.
- Use safe Prisma operations with explicit `where` clauses and allowlisted fields. Never blindly spread request payloads into database create or update calls.
- Return stable, minimal client-facing errors. Do not expose stack traces, SQL details, credentials, or unnecessary internal state.
- Preserve existing input sanitization for rich content and URLs. Do not bypass it for convenience.
- Do not redesign authentication or authorization as part of an unrelated task; flag broader security issues for a dedicated change.

In API routes, follow the existing response and error-handling helpers where they fit. Across both applications, do not swallow failures, leak internal details, or introduce a second error contract without a concrete need.

## UI and accessibility

Across both applications, use semantic HTML and the existing primitives in the owning application before introducing new markup or components. Forms need associated labels, useful validation messages, keyboard-accessible controls, visible focus states, and correct loading/disabled/error semantics. Icon-only controls need an accessible name; decorative icons need to be hidden from assistive technology. Preserve meaningful headings, landmarks, live-region behavior, and keyboard interaction for dialogs, menus, comboboxes, and editors.

Admin-specific: prefer the existing admin UI primitives. Do not treat them as public-frontend defaults or move them into `packages/shared` without demonstrated cross-application use. For public-frontend work, derive rendering, caching, performance, and metadata/SEO decisions from its current Next.js implementation and the task requirements, not from admin conventions.

The shared ESLint configuration includes Next.js Core Web Vitals and React accessibility checks. Treat those checks as a baseline, not as a substitute for reviewing the user flow.

## Audit and investigation policy

Comprehensive audits are not part of the default development workflow. Perform comprehensive or cross-project audits only when:

- The user explicitly requests an audit.
- Auditing is the primary objective of the assigned task.
- A significant architectural, security, data integrity, or systemic quality risk makes an audit necessary.
- A complex cross-cutting change cannot be implemented safely without broader investigation.

For routine feature development, bug fixes, UI refinements, component improvements, and maintenance:

- Inspect only the relevant implementation, dependencies, contracts, and tests.
- Prefer targeted investigation followed by implementation.
- Do not perform repository-wide inventories or audits by default.
- Do not repeatedly investigate previously established findings.
- Reuse existing documentation, implementation reports, and verified results when they remain applicable.
- Do not create unnecessary audit reports, inventories, or intermediate documentation.
- Do not turn implementation tasks into analysis-only tasks.
- Do not repeatedly reload unrelated skills, documentation, or source files.
- Use relevant project skills selectively.
- Expand the investigation only when concrete evidence justifies it.
- Keep debugging bounded and avoid repetitive investigation loops.

Targeted code inspection, security checks, dependency analysis, and verification necessary for safe implementation remain expected. This policy does not reduce code quality, security requirements, or automated test coverage.

When a broader audit becomes necessary, define its scope and justification before proceeding. The user's explicit instructions take precedence.

## Visual regression and browser verification

- Visual regression testing is not part of the default development workflow. Perform it only when explicitly requested, when the task is a UI/UX, design system, accessibility, or visual audit, when UI/UX changes are complex, when a significant design change or redesign is introduced, or when shared design system components or tokens have broad visual impact.
- For routine bug fixes, minor UI adjustments, styling changes, backend changes, and regular feature development, do not automatically launch visual regression suites, cross-browser verification, or comprehensive screenshot, viewport, theme, or accessibility matrices. Prefer targeted unit, component, and integration tests; run targeted functional browser tests only when needed for affected behavior. Functional E2E testing is distinct from visual regression testing.
- Do not initiate comprehensive visual regression solely because a development task or phase is being completed. Preserve existing automated test coverage; this policy limits unnecessary execution, not test quality or coverage. Explicit user verification requirements take precedence.
- When visual regression is justified, define the affected scope first, avoid repeating the same matrix, wait for readiness and hydration before client-side interactions, use bounded timeouts and retries, distinguish application defects from automation failures, and report unresolved blockers instead of entering unbounded retry loops. Do not modify working application code to compensate for unreliable automation.
- Verify visual changes in the hydrated, rendered application. Source inspection, computed CSS assumptions, unit tests, and successful builds do not by themselves establish visual correctness.
- Choose a focused browser matrix that covers the changed screens, responsive breakpoints, themes, locales, and interactions. Reuse recent successful browser evidence when relevant code and environment inputs have not changed; do not repeat a comprehensive matrix without a concrete reason.
- Wait for hydration and relevant transitions to settle before assertions or screenshots. Check actual geometry, overflow, focus, and interaction behavior where those are part of the change.
- Save requested visual evidence under the existing `.notes/admin-redesign/` structure. Keep screenshots and notes local unless the task explicitly requests tracked documentation.
- Use the existing guarded browser/E2E runners for database-backed flows. Preserve unrelated containers, networks, volumes, manifests, and databases. On interruption, inspect active processes and exact run ownership; only clean resources created by that exact run after verifying their ownership.
- Report the screens, viewports, themes, locales, and interactions actually verified, link to evidence paths, and identify incomplete coverage. Never describe untested states as verified.

## Code quality

Before creating or modifying maintained JS/JSX/MJS/CJS/TS/TSX/MTS/CTS source, explicitly read and apply [.agents/skills/nextpress-readability/SKILL.md](.agents/skills/nextpress-readability/SKILL.md), alongside relevant implementation/testing skills and verification. Its [source conventions](.agents/skills/nextpress-readability/references/source-conventions.md) are the authoritative detailed coding standard; apply them to new and modified code. Discovery metadata alone does not apply a skill. Review all task-modified and new source against selected skills before delivery; passing static checks does not prove architectural readability.

When creating, modifying, diagnosing, or reviewing tests, explicitly read and apply [.agents/skills/nextpress-testing/SKILL.md](.agents/skills/nextpress-testing/SKILL.md), alongside readability and verification requirements. Its standards are mandatory for all workspaces, scripts, and E2E tests. Identify the regression each test protects and document equivalent coverage before consolidating or removing a test.

ESLint owns quality/imports, TypeScript owns types, and root Oxfmt owns layout. Format task-owned changes with `npm run format:changed` (add `-- --files path...` when unrelated user edits exist), then run the narrowest relevant checks for the task. Use `npm run check:changed` only when aggregate staged, unstaged, and untracked scope is intended and appropriate. Include `-- --base <ref>` for committed branch changes. Detection failure must fail, never cause empty success or implicit full-repository formatting. Report readability exceptions and checks actually run.

After the final edit, rerun the task-scoped checks affected by that edit and rerun any failed check after fixing its cause. Changes to verification tooling or quality policy implementation also require `npm run format:check`, `npm run lint:readability` and the formatting regression suite (`npm run check:changed:test`); instruction-only edits use affected instruction/configuration validation. A stopped command does not verify later steps; report unresolved failures and skipped steps. Never suppress a failure to finish.

Changed-file commands inspect working-tree content at the union of staged, unstaged and untracked paths; `--base` adds committed branch paths. They do not certify index content. The pre-commit hook runs lint-staged with its default stash/hide behavior to check and format the staged snapshot, then restore unrelated unstaged edits. Do not run the staged helper directly as proof of index validation, disable hiding/stashing, or run hooks against a user's index merely to test them; use the isolated hook regression fixtures. No pre-push hook is installed; CI independently checks the repository. Final verification bypasses Turbo cache reads; ordinary workspace tasks retain caching with shared policy inputs.

Root `.oxfmtrc.json` owns layout, shared ESLint enforces braced control flow and lint rules, and `scripts/readability-core.mjs` checks structural spacing around control flow and selected multiline operation initializers. Workspace lint runs the spacing check and its owning ESLint configuration. Formatting covers maintained JS/TS modules, CSS/SCSS, JSON/JSONC, YAML, Markdown/MDX and HTML. Git selection and formatter ignore patterns exclude generated/vendor/public assets, migrations and lockfiles; Prisma, SQL, shell, TOML, environment templates and binary assets are outside Oxfmt's policy. Contextual readability review is still required. Agent discovery is a convenience, not an enforcement guarantee.

Generated code must look intentionally written and maintained by experienced developers. Prefer simple solutions, descriptive names, native framework/library behavior, and focused files.

Avoid generic boilerplate, wrapper layers, fragmented helpers, speculative abstractions, factories/managers/providers without a concrete need, `utils` dumping grounds, duplicate validation or types, needless `try/catch`, dead code, placeholder code, and inconsistent naming. Avoid decorative emoji in production code, configuration, and logs unless it is intentionally part of the product. Comments should explain why a non-obvious decision exists, not narrate obvious code.

## Testing and dependencies

- Add or update focused tests when behavior changes. Bug fixes should normally include a regression test that fails for the original defect.
- Apply the [testing skill](.agents/skills/nextpress-testing/SKILL.md) to new and substantially modified tests and dedicated test reviews. Keep ordinary feature work scoped to the affected tests and their support code.
- Run targeted workspace checks while developing, then the relevant root checks before completion. Do not weaken or delete a meaningful test to make a change pass.
- Prefer the platform and existing dependencies. Add or upgrade a dependency only when the task requires it and the benefit justifies the maintenance and security cost.
- Change dependencies in the owning workspace and let npm update `package-lock.json`; do not hand-edit the lockfile.

## Disposable Docker tests

Use the guarded test runners for Docker-backed PostgreSQL. Give each run unique ownership labels and track the exact IDs returned during provisioning. Use isolated data and loopback bindings. On success, failure, or a handled interrupt, verify the local Docker context and resource ownership before removing the run's database container, dedicated network, and any explicitly owned volume. Preserve resources if verification fails and report the remaining IDs or names. Never prune Docker or clean by name prefix.

## Commands and environment

Run commands from the repository root unless a workspace is intentionally targeted. The package manager is npm `12.2.2`.

- `npm run dev`: run workspace development servers through Turbo.
- `npm run dev:web`: run `apps/web` at `http://localhost:49100`.
- `npm run dev:api`: run `apps/api` at `http://localhost:49102`.
- `npm run dev:admin`: run `apps/admin` at `http://localhost:49101`.
- `npm run build`: build all workspaces through Turbo.
- `npm run lint`: lint all configured workspaces through Turbo.
- `npm run lint:fix`: apply the configured ESLint fixes.
- `npm test`: run the Vitest suites in all test-bearing workspaces.
- `npm run coverage`: run those suites with V8 coverage.
- `npm run format:changed`: format changed source/config/style files; never falls back to full writes.
- `npm run format:check:changed`: check those files without writing.
- `npm run check:changed`: repository-level verification over the union of staged, unstaged and untracked paths; it may select full workspace checks when any path is unrecognized. Use for an intentional aggregate working-tree/release check, not automatically for each development task.
- `npm run check:changed -- --format --files path...` and `npm run check:changed -- --format-check --files path...`: format or check only explicit task-owned paths when unrelated changes exist.
- `npm run typecheck`: run TypeScript checks for supported workspaces through Turbo.
- `npm run prisma:generate`: generate Prisma artifacts through Turbo.
- `npm run prisma:migrate`: run the database migration workflow through Turbo; use only when a migration is required.
- `npm run db:up`: start local services from `docker-compose.yml`.
- `npm run bootstrap`: start local database services, then all development servers.

Useful narrow checks include `npm --workspace api run lint`, `npm --workspace api test`, `npm --workspace admin run lint`, `npm --workspace admin test`, `npm --workspace web run lint`, `npm --workspace web test`, `npm --workspace @nextpress/db run lint`, `npm --workspace @nextpress/db test`, `npm --workspace @nextpress/db run validate`, and `npm --workspace @nextpress/shared test`. Use the relevant checks for the files changed. Do not claim a check passed unless that command was actually run and passed.

Environment templates are `apps/api/.env.example`, `apps/web/.env.example`, `apps/admin/.env.example`, and `packages/db/.env.example`. Local database/auth-dependent flows require the corresponding environment and PostgreSQL setup. Do not assume port `3000`.

## Completion checklist

Before completing work:

- Review the final diff and confirm only intended files changed.
- Run task-scoped formatting and the narrowest relevant tests, lint, typecheck, build, validation, or flow check available for the change; report anything not run and why. Do not let unrelated staged or unstaged paths expand routine development verification.
- Verify every documented command, path, environment template, and package boundary against the repository.
- Check for duplicated or contradictory agent instructions.
- Confirm no secrets, generated artifacts, unrelated application behavior, schema changes, migrations, tests, CI, Husky, or dependency upgrades were added unless explicitly requested.
- Never bypass a failing check or hook. Do not use `--no-verify` to make a commit succeed.
- Do not commit automatically. Task-specific explicit user authorization permits local commits after all applicable verification succeeds; stage only task-related files and allow Husky hooks to run normally. Pushes, merges, and pull requests always require separate authorization.
- Summarize changed files, verification performed, and any remaining observation or follow-up.

## Verification efficiency

Minimize execution overhead without weakening security or required checks:

- Prefer existing workspace-local workflows. Request elevated permissions only when needed; never bypass sandbox, approval, or security controls.
- Group related read-only inspection where practical. Load only relevant resources and avoid repeated discovery or unnecessary network requests.
- Reuse valid check results, development servers, and containers when inputs and compatibility allow. Start with task-scoped checks and stop when sufficient evidence and applicable mandatory gates are satisfied.
- Use subagents only when they offer a clear benefit. Diagnose failures before retrying and avoid unbounded retries or scope expansion without a concrete technical reason.
- Keep development verification task-scoped. Format explicit task-owned paths when unrelated changes exist, then run the owning workspace lint and focused tests/typecheck required by the change. For CSS-only or minor UI changes, run the relevant formatter and owning workspace lint; browser checks are needed only when rendered behavior cannot be established otherwise. Reserve browser regression testing for complex responsive changes, major design changes, audits, or explicit requests. Do not automatically run Playwright E2E, full visual regression, cross-browser audits, or full workspace verification for minor styling changes.
- `npm run check:changed` intentionally examines staged, unstaged, and untracked paths together. Run it only when aggregate working-tree verification is intended and its scope is appropriate; do not use it as the default task gate when unrelated staged or unstaged paths would broaden verification. Explicit `--files` is supported for formatter modes only.
- Pre-commit verification is separate: Husky and lint-staged validate the staged snapshot, including staged formatting, ESLint, readability and affected unit tests, while preserving unstaged edits. Do not bypass or weaken these checks. Do not run hook checks against the user's real index just to test them; use disposable fixtures.
- Full workspace and release verification remains required when explicitly requested, when the release/CI workflow requires it, or when a risk or root-level change makes it applicable. CI change detection and its conservative full-validation fallback remain unchanged.
- During implementation, avoid unnecessary full builds, repeated installs, database initialization, and coverage runs; reuse successful results while relevant inputs remain unchanged.
- Before committing, run applicable mandatory staged-snapshot checks, relevant integration/security/browser checks, and `git diff --check`. Use aggregate `npm run check:changed` only when its combined local-change scope is intended.
- Reproduce failures with the smallest relevant command. Separate code regressions from environment or resource failures; after two unsuccessful targeted repair attempts, reassess the cause instead of repeating the same command. Do not raise timeouts or memory limits without evidence.
- Never weaken tests, authorization, or security requirements. Do not bypass Husky or any required check.
