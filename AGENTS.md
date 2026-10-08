# NextPress agent guide

This file is the repository-level source of truth for coding agents. Read it before changing files, preserve unrelated user work, and keep changes limited to the requested work. Optional, task-specific guidance is indexed in `.agents/README.md`; load only the skill or workflow relevant to the current task.

## Repository map

NextPress is an npm workspace monorepo run with Turborepo:

- `apps/web`: public-facing Next.js application.
- `apps/admin`: authenticated Next.js administration application, content editing UI, and API route handlers.
- `packages/db`: Prisma schema, generated client integration, migrations, seed logic, and database package code.
- `packages/shared`: genuinely cross-workspace TypeScript exports.
- `packages/eslint-config`: shared flat ESLint configuration for the Next.js applications.

Both applications are first-class. Keep code in its owning workspace, and do not assume that an admin pattern also belongs in the public application. Add to `packages/shared` only when more than one workspace needs the same abstraction.

Admin-specific: keep admin UI organized with the existing `src/components`, `src/ui`, `src/lib`, and `src/app/api` split. Admin validation commonly lives in `src/lib/validation`; follow a nearby implementation before adding another location.

The database package owns `packages/db/prisma/schema.prisma`, migrations, seed logic, and the Prisma client. Do not edit generated output. Do not change the schema or migrations unless the task explicitly requires a database change and includes the appropriate Prisma workflow.

## Grounded implementation

Before implementing:

1. Check `git status` and inspect the relevant diff so existing user work is preserved.
2. Inspect the target files and search for existing components, services, validation schemas, repository methods, route handlers, and shared types.
3. Verify paths, package scripts, configuration, and runtime assumptions in the repository. Do not invent APIs, routes, fields, environment variables, dependencies, or abstractions.
4. Follow an existing good pattern when it fits; if the pattern is unsafe, obsolete, incorrectly typed, or inconsistent, fix the underlying issue rather than copying it.

Prefer a small, direct change with readable control flow. Avoid speculative refactors and cross-package coupling.
Preserve existing behavior unless the task intentionally changes it, and make that behavior change explicit in tests and the final report.

## TypeScript and data flow

- Preserve the strict TypeScript baseline in `tsconfig.base.json`; never weaken compiler or ESLint settings to make a change compile.
- Prefer domain types, inferred types where readable, schema-derived types, Prisma-generated types, and library-provided types.
- Narrow `unknown` at boundaries. Avoid `any`, unsafe casts, unnecessary `as`, `@ts-ignore`, and unnecessary non-null assertions.
- Reuse existing types and schemas instead of duplicating interfaces or validation rules.
- Treat request bodies, query parameters, form values, URL values, uploaded content, and external responses as untrusted. Validate them at the appropriate boundary; use the existing Zod validation and error-handling patterns in admin where applicable.
- Keep client and server responsibilities clear in Next.js. Do not import server-only database, secret, or authentication code into client components.

## Security

- Authentication and authorization are different responsibilities. Enforce authorization on the server for every protected operation.
- Admin-specific: preserve the existing Better Auth/session boundaries and reuse server auth helpers such as `withAuth` and role checks rather than relying on hidden UI controls or client-provided roles.
- Never expose secrets, credentials, tokens, session secrets, OAuth secrets, database URLs, or other sensitive environment values to client code or logs. Keep real `.env` files out of Git; update only `.env.example` when documenting required variables.
- Use safe Prisma operations with explicit `where` clauses and allowlisted fields. Never blindly spread request payloads into database create or update calls.
- Return stable, minimal client-facing errors. Do not expose stack traces, SQL details, credentials, or unnecessary internal state.
- Preserve existing input sanitization for rich content and URLs. Do not bypass it for convenience.
- Do not redesign authentication or authorization as part of an unrelated task; flag broader security issues for a dedicated change.

In admin API routes, follow the existing response and error-handling helpers where they fit. Across both applications, do not swallow failures, leak internal details, or introduce a second error contract without a concrete need.

## UI and accessibility

Across both applications, use semantic HTML and the existing primitives in the owning application before introducing new markup or components. Forms need associated labels, useful validation messages, keyboard-accessible controls, visible focus states, and correct loading/disabled/error semantics. Icon-only controls need an accessible name; decorative icons need to be hidden from assistive technology. Preserve meaningful headings, landmarks, live-region behavior, and keyboard interaction for dialogs, menus, comboboxes, and editors.

Admin-specific: prefer the existing admin UI primitives. Do not treat them as public-frontend defaults or move them into `packages/shared` without demonstrated cross-application use. For public-frontend work, derive rendering, caching, performance, and metadata/SEO decisions from its current Next.js implementation and the task requirements, not from admin conventions.

The shared ESLint configuration includes Next.js Core Web Vitals and React accessibility checks. Treat those checks as a baseline, not as a substitute for reviewing the user flow.

## Code quality

Generated code must look intentionally written and maintained by experienced developers. Prefer simple solutions, descriptive names, native framework/library behavior, and focused files.

Avoid generic boilerplate, wrapper layers, fragmented helpers, speculative abstractions, factories/managers/providers without a concrete need, `utils` dumping grounds, duplicate validation or types, needless `try/catch`, dead code, placeholder code, and inconsistent naming. Avoid decorative emoji in production code, configuration, and logs unless it is intentionally part of the product. Comments should explain why a non-obvious decision exists, not narrate obvious code.

## Testing and dependencies

- Add or update focused tests when behavior changes. Bug fixes should normally include a regression test that fails for the original defect.
- Prefer behavior and boundary assertions over implementation details. Follow nearby Vitest and React Testing Library patterns and keep tests in the owning workspace.
- Run targeted workspace checks while developing, then the relevant root checks before completion. Do not weaken or delete a meaningful test to make a change pass.
- Prefer the platform and existing dependencies. Add or upgrade a dependency only when the task requires it and the benefit justifies the maintenance and security cost.
- Change dependencies in the owning workspace and let npm update `package-lock.json`; do not hand-edit the lockfile.

## Commands and environment

Run commands from the repository root unless a workspace is intentionally targeted. The package manager is npm `10.2.4`.

- `npm run dev`: run workspace development servers through Turbo.
- `npm run dev:web`: run `apps/web` at `http://localhost:49100`.
- `npm run dev:admin`: run `apps/admin` at `http://localhost:49101`.
- `npm run build`: build all workspaces through Turbo.
- `npm run lint`: lint all configured workspaces through Turbo.
- `npm run lint:fix`: apply the configured ESLint fixes.
- `npm test`: run the Vitest suites in all test-bearing workspaces.
- `npm run coverage`: run those suites with V8 coverage.
- `npm run typecheck`: run TypeScript checks for supported workspaces through Turbo.
- `npm run prisma:generate`: generate Prisma artifacts through Turbo.
- `npm run prisma:migrate`: run the database migration workflow through Turbo; use only when a migration is required.
- `npm run db:up`: start local services from `docker-compose.yml`.
- `npm run bootstrap`: start local database services, then all development servers.

Useful narrow checks include `npm --workspace admin run lint`, `npm --workspace admin test`, `npm --workspace web run lint`, `npm --workspace web test`, `npm --workspace @nextpress/db run lint`, `npm --workspace @nextpress/db test`, `npm --workspace @nextpress/db run validate`, and `npm --workspace @nextpress/shared test`. Use the relevant checks for the files changed. Do not claim a check passed unless that command was actually run and passed.

Environment templates are `apps/web/.env.example`, `apps/admin/.env.example`, and `packages/db/.env.example`. Local database/auth-dependent flows require the corresponding environment and PostgreSQL setup. Do not assume port `3000`.

## Completion checklist

Before completing work:

- Review the final diff and confirm only intended files changed.
- Run the narrowest relevant tests, lint, typecheck, build, validation, or flow check available for the change; report anything not run and why.
- Verify every documented command, path, environment template, and package boundary against the repository.
- Check for duplicated or contradictory agent instructions.
- Confirm no secrets, generated artifacts, unrelated application behavior, schema changes, migrations, tests, CI, Husky, or dependency upgrades were added unless explicitly requested.
- Never bypass a failing check or hook. Do not use `--no-verify` to make a commit succeed.
- Do not commit or push unless the user explicitly requests it.
- Summarize changed files, verification performed, and any remaining observation or follow-up.
