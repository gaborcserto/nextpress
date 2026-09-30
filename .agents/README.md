# NextPress agent resources

`../AGENTS.md` is the single source of truth for stable repository knowledge and rules. This directory contains optional guidance that should be loaded only when it matches the task.

## Responsibilities

- **Repository knowledge:** `../AGENTS.md` describes NextPress structure, boundaries, commands, and non-negotiable engineering rules.
- **Skills:** `skills/` contains technical guidance for recurring work that depends on NextPress-specific tooling or patterns.
- **Workflows:** `workflows/` contains short procedures for safely carrying out a class of repository work.
- **Specialized agents:** none. Current review needs are covered without separate role prompts.
- **Provider integration:** none. These Markdown resources are intentionally provider-neutral.

## Available resources

- `skills/nextpress-testing/SKILL.md`: use when adding, changing, diagnosing, or reviewing tests and coverage.
- `workflows/change.md`: use for features, bug fixes, and refactors.
- `workflows/review.md`: use for architecture, security, accessibility, performance, rendering, caching, SEO, reliability, or final audits where findings are the primary output.

Start with `AGENTS.md`, load only the relevant resource above, inspect the repository for current facts, and then do the work. A task may use a skill and a workflow together when both add value.

Resources apply across the monorepo unless a section is explicitly labeled for one application. Inspect the owning application before reusing its conventions in the other; shared concerns do not imply shared implementation.

This directory is version controlled. Local IDE state, credentials, transcripts, scratch prompts, and provider caches should remain outside it or in already ignored local directories. Add provider-specific configuration only when a concrete integration requires it; do not duplicate these instructions for individual providers.
