---
name: nextpress-testing
description: Add, update, diagnose, or review NextPress tests and coverage using the repository's Vitest and React Testing Library setup. Use for behavior changes, regressions, test failures, or coverage work; not for checks unrelated to tests.
---

# NextPress testing

Inspect the owning workspace's package scripts, Vitest configuration, nearby implementation, and nearby tests before choosing the test level. Keep tests beside the code they exercise using the existing `*.test.ts` or `*.test.tsx` convention.

## Choose the smallest useful level

- Test validation, transformations, role logic, and other pure behavior directly.
- For React UI in either application, use React Testing Library through the owning app's jsdom setup. Assert accessible user-observable behavior; use structural or class assertions only when that structure is the contract.
- Admin-specific: for route behavior, exercise exported route handlers with `Request` objects and mock external boundaries such as Prisma, hashing, and authentication. Cover authorization, invalid input, stable status/error contracts, and persistence calls without requiring a live database.
- For Prisma schema invariants that do not require a database, follow the existing file-based schema test. Use database-backed tests only when the behavior cannot be established at a cheaper boundary and the required environment is part of the task.

Use the owning application's Vitest configuration and setup file. Both applications alias `server-only` in their Vitest configuration; use the owning application's setup and check its mocks before relying on them. Hoist module mocks when Vitest import ordering requires it, reset shared mock state between cases, and avoid snapshots or broad mocks that obscure the behavior under test.

During development, run the owning workspace's test command, optionally with a file path accepted by Vitest. Before completion, run the root `npm test` and `npm run coverage` when the scope or user request calls for repository-wide verification. Report the commands actually run and any environmental limitation; do not infer coverage quality solely from a passing command because the repository does not define coverage thresholds.
