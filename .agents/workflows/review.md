# Repository review workflow

Use this workflow when the primary output is an architecture, security, accessibility, performance, rendering, caching, SEO, reliability, or final-audit report. `../../AGENTS.md` remains authoritative.

1. Check `git status` and relevant diffs so findings distinguish the baseline from uncommitted work.
2. Define the review surface and acceptance criteria from the request. Map the owning workspaces, entry points, configuration, data flow, and existing tests before drawing conclusions.
3. Trace concrete behavior across boundaries. Use repository evidence—file locations, callers, configuration, and commands—rather than inferred conventions. For security reviews, follow untrusted input through validation, authorization, persistence, and response handling. For UI reviews, include keyboard, semantics, focus, loading, error, and responsive behavior where applicable. For Next.js application reviews, inspect actual server/client boundaries, rendering, metadata, caching or revalidation, and asset or data loading when those concerns are in scope; do not infer one application's strategy from the other.
4. Validate suspected issues with the narrowest safe read-only check or reproduction available. Separate confirmed defects from risks, design preferences, and questions. Do not modify application code unless implementation is explicitly in scope.
5. Rank findings by user impact and likelihood. Each finding should state the evidence, consequence, and smallest credible remediation. Call out test gaps only when a meaningful behavior or boundary is unprotected.
6. Review the report for duplicates, unsupported claims, and scope creep. If files changed as part of the requested review, run appropriate checks plus `git diff --check` and inspect the final diff.
7. Report findings first, then assumptions, verification performed, and residual risks. A clean review should say that no confirmed findings were identified while still noting meaningful coverage limits. Do not commit or push unless explicitly requested.
