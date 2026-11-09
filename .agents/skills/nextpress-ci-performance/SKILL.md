---
name: nextpress-ci-performance
description: Evaluate proposed CI runtime improvements in the NextPress npm and Turborepo workflows.
---

# CI performance methodology

Base decisions on observed workflow duration and bottlenecks. Preserve correctness, security coverage, and useful failure visibility while optimizing.

- Inspect `.github/workflows/`, root scripts, workspace scripts, `turbo.json`, lockfile, and cache keys before proposing changes.
- Compare equivalent runs and separate checkout, install, build, lint, typecheck, and test time. Account for cache hit and miss behavior rather than relying on a single warm run.
- Respect workspace boundaries and Turborepo dependency ordering. Avoid duplicating verification infrastructure or hiding failures behind permissive shell logic.
- Preserve pinned GitHub Actions, least-privilege permissions, CodeQL, and dependency security checks.
- Do not implement changed-file verification or CI parallelization unless specifically in scope. Report tradeoffs and run workflow/configuration validation available in the repository.