# Repository change workflow

Use this workflow for a feature, bug fix, or refactor. `../../AGENTS.md` remains authoritative.

1. Check `git status` and the relevant diff. Identify existing user changes that must be preserved.
2. Locate the owning workspace and inspect its manifest, configuration, implementation, types, validation, tests, and callers. Treat each application's local conventions as application-specific unless existing cross-application use proves otherwise. Search before introducing a new pattern.
   Before source edits read [readability](../skills/nextpress-readability/SKILL.md) and applicable implementation/testing skills. Use [verification](../skills/nextpress-verification/SKILL.md) before completion.
3. Define the intended behavior and boundaries. For a bug, reproduce or characterize the failure before fixing it. Identify security, server/client, accessibility, and data-migration implications that actually apply.
4. Make the smallest cohesive change. Keep validation at untrusted boundaries, authorization on the server, and code in the owning workspace. Add or update focused tests for behavior changes.
5. Run targeted tests and static checks for the affected workspace while iterating. Address the cause of failures; do not suppress checks or weaken assertions.
   Format task-owned changes with `npm run format:changed` (explicit `-- --files path...` when user changes coexist), then `npm run check:changed`; add `-- --base <ref>` for committed branch work. Detection failures must fail.
6. Run the appropriate root verification for the final scope. Documentation-only changes normally need content/reference validation and `git diff --check`; application or configuration changes need checks proportional to the change, selected through the verification skill; small refactors do not automatically require builds, coverage or full suites.
7. Review `git status`, `git diff`, and `git diff --check`. Remove incidental changes, generated output, debug code, and abstractions that no longer justify themselves.
   Review all modified/new task source against selected skills, check formatting stability and report contextual exceptions. Green static checks do not prove architectural readability.
8. Report behavior changed, files changed, checks run, and remaining risks. Do not stage, commit or push unless explicitly requested.
