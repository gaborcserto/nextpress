---
name: nextpress-api-contracts
description: Change or review NextPress API contracts across Zod validation, OpenAPI documentation, route handlers, and shared package types.
---

# API contracts

Apply [NextPress readability](../nextpress-readability/SKILL.md) for request preparation, validation, asynchronous control flow and safe error context.

Inspect the route, callers, validation schemas, OpenAPI generation, and shared exports before changing a contract. Admin APIs live in `apps/api`; do not move app-specific behavior into `packages/shared` without demonstrated cross-workspace use.

- Treat body, path, query, and external values as untrusted. Reuse or extend the existing Zod schemas and route error helpers; avoid duplicate validation rules.
- Validate only inputs that apply to the boundary: body, query, route params and relevant headers/cookies. Normalize and bound explicitly; account for duplicate query keys and unknown fields according to compatibility needs instead of applying blanket strictness or coercion. Keep schemas with their owner and infer TypeScript types from authoritative Zod schemas where useful.
- Backend validation is authoritative; client validation improves usability. Validation is distinct from authentication, authorization, database constraints, transaction guarantees, rate limiting, and body/resource limits. Preserve those protections and their ordering.
- Preserve server-side authentication and authorization. Better Auth establishes identity; protected operations still need their existing role or permission checks.
- Keep Prisma calls explicit: use scoped `where` clauses and allowlisted fields, and do not spread request payloads into writes.
- The OpenAPI contract in `apps/api/src/lib/api/openapi.ts` is the canonical API reference. It combines operation metadata with schemas derived from existing Zod validation and shared content schemas. Route Handlers and runtime schemas remain authoritative for behavior; update the contract when their behavior changes. Do not create a manually synchronized endpoint catalog in Markdown.
- When adding or changing an owned Route Handler, update its operation metadata and response projection. Reuse its Zod request schema where available; describe runtime-only rules and authorization in the operation. Better Auth's delegated `/api/auth/*` routes remain outside this first-party contract.
- Update OpenAPI definitions and contract tests alongside behavior. Root `npm run openapi:validate` validates the document and coverage of owned route methods. Export formatted JSON to stdout with `npm --workspace api run --silent openapi:export`; no generated contract artifact is committed.
- Keep request/response shapes, enums, nullability, defaults, bounds and documented error responses consistent with runtime behavior. Use stable machine-readable error identifiers and field/path information where the existing envelope supports it; keep details bounded and safe. Validate responses at untrusted or unstable boundaries when runtime enforcement adds value, not mechanically for internal calls.
- Constrain search, filtering, sorting and pagination with explicit allowlists and product/security-justified bounds. Test duplicate/missing/malformed values and normalization when they affect the contract. Document routes with no applicable input rather than inventing schemas.
- In development, `npm run dev:admin` serves the browser reference at `http://localhost:49101/api-docs` and JSON at `http://localhost:49101/api/openapi`; both return 404 outside development. Execute uses the current browser session and writes can modify real data. Documentation visibility does not enforce endpoint authentication or authorization; requests remain subject to server-side authentication, authorization, CSRF, and validation.
- Update `packages/shared` only for genuinely shared types or behavior, and preserve stable minimal error responses.
- Run the owning app's tests, lint, and typecheck, plus OpenAPI validation for contract changes. See [NextPress verification](../nextpress-verification/SKILL.md).
