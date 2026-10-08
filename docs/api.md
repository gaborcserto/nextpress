# API contract workflow

The OpenAPI contract in `apps/admin/src/lib/api/openapi.ts` is the canonical API
reference. It combines operation metadata with schemas derived from existing
Zod validation and shared content schemas. Route Handlers and runtime schemas
remain authoritative for behavior; update the contract when their behavior
changes. Do not add a manually synchronized endpoint catalog to Markdown.

Run `npm run dev:admin` to view the browser reference at
`http://localhost:49101/api-docs` or the JSON contract at
`http://localhost:49101/api/openapi`. Both are available only in development.
The viewer is read-only. Documentation visibility does not enforce endpoint
authentication or authorization.

After adding or changing an owned Route Handler, update its operation metadata
and response projection in the OpenAPI module. Reuse the route's existing Zod
schema for request shapes where available; describe runtime-only rules and
authorization in the operation. Better Auth's delegated `/api/auth/*` routes
remain outside this first-party contract.

Validate the OpenAPI document and coverage of owned route methods with:

```bash
npm run openapi:validate
```

Export formatted JSON to stdout for external OpenAPI tooling with:

```bash
npm --workspace admin run --silent openapi:export
```

No generated contract artifact is committed, so the contract has no separate
generated file to synchronize.
