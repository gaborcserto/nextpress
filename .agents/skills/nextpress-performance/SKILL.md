---
name: nextpress-performance
description: Investigate or change React rendering, data loading, bundle size, or runtime performance in either NextPress application.
---

# React performance

Start with the user-visible symptom and inspect the owning app's existing rendering and data-loading path. Measure or reproduce before optimizing; avoid speculative memoization and broad rewrites.

- In App Router code, keep server work on the server, avoid unnecessary client boundaries, and parallelize independent server data requests when ordering is not required.
- Check repeated rendering, expensive derived work, list size, image loading, and client bundle imports. Use `memo`, `useMemo`, and `useCallback` only when there is evidence they address repeated costly work.
- Inspect the actual cache, revalidation, and streaming behavior of the relevant Next.js route. Do not make caching assumptions across `apps/web` and `apps/admin`.
- Keep data access within the owning workspace and preserve Prisma query selectivity, authorization, and response contracts.
- Verify with the narrowest reliable reproduction or profiling evidence, then run relevant workspace checks. See [NextPress verification](../nextpress-verification/SKILL.md).