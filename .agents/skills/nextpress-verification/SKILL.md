---
name: nextpress-verification
description: Select, run, and report proportionate verification for NextPress code, configuration, and documentation changes.
---

# Change verification

For maintained source edits read [readability](../nextpress-readability/SKILL.md). Format task-owned files with `npm run format:changed`, then run `npm run check:changed` for formatting plus affected lint/typecheck/tests. With unrelated user edits use explicit `-- --files path...` for formatting. Add `-- --base <ref>` for committed branch scope; an empty worktree does not verify a branch. Detection failure is an error.

Review all modified/new task files against selected skills and check formatting stability. Passing formatter/lint checks is not architectural review. Report scope, actual checks, exceptions and skipped checks.

For small refactors, use focused lint, affected application typechecks and relevant existing tests; add tests only for changed behavior or a demonstrated regression. Avoid unrelated builds, audits and full suites. If changed-file detection includes unrelated work and broadens checks, run explicit targeted checks and report the scope exception.

Read root and owning workspace scripts before selecting commands. Do not claim a check passed unless it ran successfully; report skipped checks and concrete environmental reasons.

- For behavior changes, run focused tests in the owning workspace, then relevant lint and typecheck. Follow [NextPress testing](../nextpress-testing/SKILL.md) for test design.
- For OpenAPI contract changes, run `npm run openapi:validate`. For database schema changes, follow the repository's Prisma workflow and do not edit generated artifacts.
- For agent resources or repository configuration, validate local links, scripts, workflow syntax, and `git diff --check` as applicable.
- Broader root checks include `npm test`, `npm run coverage`, `npm run lint`, `npm run typecheck`, and `npm run build`; choose those required by scope rather than running unrelated costly checks automatically.
- Review `git status` and the complete diff. Preserve unrelated changes and report exact commands and outcomes.