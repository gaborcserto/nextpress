---
name: nextpress-readability
description: Required when creating or modifying maintained JavaScript, TypeScript, JSX or TSX source in NextPress, including tests and tooling; also use for readability reviews.
---

# Code readability

Read [source conventions](references/source-conventions.md) before source edits. Preserve behavior and boundaries; review-only work does not authorize refactoring. Apply conventions during implementation and review all task-modified/new source before delivery.

Apply the [import-path policy](references/source-conventions.md#import-paths-and-public-entry-points): prefer relative paths within a component/feature and explicit public module entry points across boundaries. Do not replace local imports with broad barrels or add barrels just to shorten paths. IDE import-shortening suggestions are optional hints; review cycles and Server/Client boundaries before accepting them.

Oxfmt owns layout, ESLint owns quality/imports and TypeScript owns types. Do not enable formatter import sorting or duplicate formatting rules. Run `npm run format:changed` on task-owned files and `npm run check:changed`; include `-- --base <ref>` for committed branch scope. Use explicit `-- --files path...` with formatter commands when unrelated user changes exist. Report contextual exceptions: green checks do not prove cohesive architecture.

Make the control flow and domain intent easier to understand without introducing abstraction for its own sake. First inspect nearby code and follow its established naming and organization.

- Prefer descriptive names, direct control flow, and small cohesive functions. Keep app-specific code in its owning workspace.
- Avoid generic wrappers, helper dumping grounds, speculative factories, duplicated types or validation, and comments that narrate obvious behavior.
- Preserve strict TypeScript, domain/schema-derived types, and existing error contracts. Do not trade correctness, authorization, accessibility, or performance for shorter code.
- Keep refactors behavior-preserving and separate them from behavior changes when that makes review clearer.
- Run relevant tests and static checks for changed behavior. See [NextPress verification](../nextpress-verification/SKILL.md).
