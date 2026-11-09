---
name: nextpress-readability
description: Improve or review code readability in NextPress when readability is explicitly part of the change or a concrete maintenance issue.
---

# Code readability

Make the control flow and domain intent easier to understand without introducing abstraction for its own sake. First inspect nearby code and follow its established naming and organization.

- Prefer descriptive names, direct control flow, and small cohesive functions. Keep app-specific code in its owning workspace.
- Avoid generic wrappers, helper dumping grounds, speculative factories, duplicated types or validation, and comments that narrate obvious behavior.
- Preserve strict TypeScript, domain/schema-derived types, and existing error contracts. Do not trade correctness, authorization, accessibility, or performance for shorter code.
- Keep refactors behavior-preserving and separate them from behavior changes when that makes review clearer.
- Run relevant tests and static checks for changed behavior. See [NextPress verification](../nextpress-verification/SKILL.md).