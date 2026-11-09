---
name: nextpress-verification
description: Select, run, and report proportionate verification for NextPress code, configuration, and documentation changes.
---

# Change verification

Read root and owning workspace scripts before selecting commands. Do not claim a check passed unless it ran successfully; report skipped checks and concrete environmental reasons.

- For behavior changes, run focused tests in the owning workspace, then relevant lint and typecheck. Follow [NextPress testing](../nextpress-testing/SKILL.md) for test design.
- For OpenAPI contract changes, run `npm run openapi:validate`. For database schema changes, follow the repository's Prisma workflow and do not edit generated artifacts.
- For agent resources or repository configuration, validate local links, scripts, workflow syntax, and `git diff --check` as applicable.
- Broader root checks include `npm test`, `npm run coverage`, `npm run lint`, `npm run typecheck`, and `npm run build`; choose those required by scope rather than running unrelated costly checks automatically.
- Review `git status` and the complete diff. Preserve unrelated changes and report exact commands and outcomes.