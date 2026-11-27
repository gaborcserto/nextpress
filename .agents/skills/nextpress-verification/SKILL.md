---
name: nextpress-verification
description: Select, run, and report proportionate verification for NextPress code, configuration, and documentation changes.
---

# Change verification

For maintained source edits read [readability](../nextpress-readability/SKILL.md). Format task-owned files with `npm run format:changed`, then run the narrowest relevant lint, typecheck, and tests for the change. Use `npm run check:changed` only when aggregate staged, unstaged, and untracked scope is intended and appropriate; unrelated user changes can expand its checks. Use explicit `-- --files path...` for formatting when unrelated edits exist. Add `-- --base <ref>` for committed branch scope; an empty worktree does not verify a branch. Detection failure is an error.

Review all modified/new task files against selected skills and check formatting stability. Passing formatter/lint checks is not architectural review. Report scope, actual checks, exceptions and skipped checks.

For small refactors, use focused lint, affected application typechecks and relevant existing tests; add tests only for changed behavior or a demonstrated regression. Avoid unrelated builds, audits and full suites. If changed-file detection includes unrelated work and broadens checks, run explicit targeted checks and report the scope exception.

Read root and owning workspace scripts before selecting commands. Do not claim a check passed unless it ran successfully; report skipped checks and concrete environmental reasons.

- For behavior changes, run focused tests in the owning workspace, then relevant lint and typecheck. Follow [NextPress testing](../nextpress-testing/SKILL.md) for test design.
- For OpenAPI contract changes, run `npm run openapi:validate`. For database schema changes, follow the repository's Prisma workflow and do not edit generated artifacts.
- For agent resources or repository configuration, validate local links, scripts, workflow syntax, and `git diff --check` as applicable.
- Broader root checks include `npm test`, `npm run coverage`, `npm run lint`, `npm run typecheck`, and `npm run build`; choose those required by scope rather than running unrelated costly checks automatically.
- Review `git status` and the complete diff. Preserve unrelated changes and report exact commands and outcomes.
  For changes to verification tooling or quality policy implementation, also run `npm run format:check`, `npm run lint:readability` and `npm run check:changed:test`. For instruction-only edits, validate affected instruction files and agent configuration. See root AGENTS.md for index versus working-tree semantics and required failure recovery. Rerun final verification after corrections; do not count steps after a failed command as executed.

## Historical and coverage-only failures

Verify in the condition that exposed the failure when available. For a coverage
timeout, compare focused execution with and without coverage, then run the complete
configured coverage suite and representative task overlap when practical. Record
worker limits, cache state, environment and comparable timing scope. Run coverage
commands for the same workspace sequentially or give them distinct report
directories. See
[CI performance](../nextpress-ci-performance/SKILL.md) for task-level comparisons.
Report the observed mechanism separately from an inferred cause, and describe a
historical failure as unreproduced when local evidence does not establish closure.
