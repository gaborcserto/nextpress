# Dependency update workflow

Use this workflow for an explicitly requested dependency change. Keep dependency edits scoped to the owning workspace and preserve the existing lockfile workflow.

1. Inspect `git status`, package manifests, lockfile, and existing Dependabot configuration. Confirm the target package's use and supported versions from authoritative package documentation.
2. Distinguish production from development dependencies. Do not upgrade unrelated packages, add overrides, or hand-edit `package-lock.json`.
3. Make the smallest compatible manifest change and use npm 10.2.4 to update the lockfile. Review the complete lockfile diff for unrelated churn.
4. For security changes, run `npm audit --omit=dev` for production dependencies; run full `npm audit` when development dependencies or the whole dependency tree are in scope. Report advisories and remediation status accurately.
5. Run the owning workspace tests, lint, typecheck, and build as applicable; run root checks when impact crosses workspaces. Run Prisma generation/validation only when the changed dependency or schema workflow requires it.
6. Review `git diff --check`, manifests, lockfile, and `git status`. Preserve manual staging, commits, pushes, and PR creation.
