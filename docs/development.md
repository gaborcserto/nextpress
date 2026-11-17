## Development and testing

- `npm run dev` starts all applications. `npm run dev:api`, `npm run dev:admin` and `npm run dev:web` start selected applications with their API dependency.
- `npm run build`, `npm run lint` and `npm run typecheck` run repository checks. `npm test` runs workspace tests; opt-in database suites require their isolated runner.
- `npm run check:changed` checks affected workspaces. Use `npm run format:changed` to format selected changed files or `npm run format:check:changed` to check them without writing.
- `npm run test:e2e` runs the broader browser suite. Install Playwright Chromium first with `npx playwright install chromium`; Linux may require `npx playwright install --with-deps chromium`.

## Isolated backend integration tests

The guarded PostgreSQL suites use disposable PostgreSQL 18 clusters, independently verify database identity, and clean up after the run. They are separate from the Compose development database. See the [API integration testing guide](../apps/api/README.md#isolated-integration-tests) for prerequisites, supported Docker contexts, ports and recovery instructions.

## Workspace guides

- [API configuration, OpenAPI and backend integration tests](../apps/api/README.md)
- [Admin application](../apps/admin/README.md)
- [Public website](../apps/web/README.md)

The development API reference is available at `http://localhost:49101/api-docs`; its JSON is at `/api/openapi`. Both are unavailable outside development. Validate the contract from the repository root with `npm run openapi:validate`.
