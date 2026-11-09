---
name: nextpress-api-contracts
description: Change or review NextPress API contracts across Zod validation, OpenAPI documentation, route handlers, and shared package types.
---

# API contracts

Inspect the route, callers, validation schemas, OpenAPI generation, and shared exports before changing a contract. Admin APIs live in `apps/admin`; do not move app-specific behavior into `packages/shared` without demonstrated cross-workspace use.

- Treat body, path, query, and external values as untrusted. Reuse or extend the existing Zod schemas and route error helpers; avoid duplicate validation rules.
- Preserve server-side authentication and authorization. Better Auth establishes identity; protected operations still need their existing role or permission checks.
- Keep Prisma calls explicit: use scoped `where` clauses and allowlisted fields, and do not spread request payloads into writes.
- Update OpenAPI definitions and contract tests alongside behavior. The root `npm run openapi:validate` script validates the admin OpenAPI contract.
- Update `packages/shared` only for genuinely shared types or behavior, and preserve stable minimal error responses.
- Run the owning app's tests, lint, and typecheck, plus OpenAPI validation for contract changes. See [NextPress verification](../nextpress-verification/SKILL.md).