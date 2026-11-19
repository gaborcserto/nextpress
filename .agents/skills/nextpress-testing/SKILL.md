---
name: nextpress-testing
description: Add, update, diagnose, or review NextPress tests and coverage using the repository's Vitest and React Testing Library setup. Use for behavior changes, regressions, test failures, or coverage work; not for checks unrelated to tests.
---

# NextPress testing

## Design and review standard

Every test must protect an identifiable regression within one cohesive behavior
or scenario. Several related assertions can establish that scenario. Review
unrelated responsibilities, unclear action sequences, branching, setup noise,
runtime cost, and failure diagnostics. Keep a cohesive integration journey
together when splitting it would repeat expensive setup with no diagnostic gain.

Name tests for the observable behavior and relevant condition. A reader should
be able to identify the failed scenario from the test name and assertion. Keep
happy paths, validation failures, authorization decisions, and persistence
outcomes separate when they represent independently diagnosable behavior.

Group setup, actions, and outcomes with blank lines at meaningful boundaries.
Keep related assertions together and allow successive action and outcome phases
in a single journey. Keep setup close to the test. Extract small helpers when
they remove real duplication and leave the action and expected result visible.
Use small, representative fixtures and keep parameterized case tables beside
their tests. Give each variant a descriptive name and account for repeated
setup or rendering when adding variants.

Assert observable outcomes such as accessible controls and text, resolved or
rejected results, HTTP contracts, or server-confirmed persisted state. Assertions
about calls are useful when the call is part of a boundary contract. Prefer
examples with explicit expected outcomes over recreating the production algorithm.
Use snapshots and structural assertions only when the captured details are part
of the contract.

Await the specific observable completion signal. Use bounded polling of
observable state when the boundary exposes no completion signal. Control races
with deferred promises and use fake timers for behavior governed by clocks
such as expiry, debounce, and retry. Advance the relevant clock, flush pending
work with the runner or React's `act` as needed, and restore real timers.

Mock external boundaries with realistic responses and errors while preserving
the behavior under test. Restore mocks, timers, globals, environment, and shared
state and clean up rendered UI and resources. Share setup only when mutable
state is reset and each case can run independently.

### Review coverage and cost

Before consolidating or removing a test, record the original regression, the
surviving test, and evidence that the survivor fails for the same regression.
Check the testing level as well as the scenario. A schema, a route, and a real
database transaction can protect different failure modes for the same feature.
Preserve distinct authorization, security, validation, API contract, persistence,
timing, cancellation, cleanup, and async lifecycle coverage.

Use coverage reports to find potentially missing paths and inspect the
assertions that exercise them. Judge value by the behavior protected. Test
counts, assertion counts, source length, and coverage percentages are supporting
information. Measure comparable runs before and after runtime changes and
separate test time from setup, environment, worker contention, and instrumentation
where relevant. Preserve meaningful assertions and isolation. When reproducing
a flake, record the runner, seed or order, load, and failure diagnostics.
Fix the observed cause and preserve existing gates, timeout, and retry policies.

### Cohesion examples

Admission, publication controls, and acknowledged saves can be tested
independently when their setup is cheap. Keep PAGE and POST variants when their
editor paths protect distinct regressions. A save journey can also verify the
request and acknowledged UI state together when they establish the same outcome.

```tsx
it("keeps the publication date disabled for a private draft", async () => {
  renderPrivateDraft("PAGE");

  expect(
    await screen.findByRole("region", { name: "Private draft" }),
  ).toBeVisible();
  expect(screen.getByLabelText("Publish date", { exact: true })).toBeDisabled();
});
```

Avoid hiding the whole workflow behind a helper that only says what the test is
supposed to do:

```tsx
it("saves the draft", async () => {
  await runAllPrivateDraftAssertionsAndSave();
  expect(screen.getByLabelText("Title")).toHaveValue("Updated");
});
```

The title value may be optimistic. Assert the acknowledged request/response or
server-confirmed state that defines completion for the behavior under test.

Inspect the owning workspace's package scripts, Vitest configuration, nearby implementation, and nearby tests before choosing the test level. Keep tests beside the code they exercise using the existing `*.test.ts` or `*.test.tsx` convention.

## Choose the cheapest level that proves the contract

- Test validation, transformations, role logic, and other pure behavior directly.
- For React UI in either application, use React Testing Library through the owning app's jsdom setup. Prefer queries for accessible roles, names, and labels.
- API-specific: for route behavior, exercise exported route handlers with `Request` objects and mock external boundaries such as Prisma, hashing, and authentication. Cover authorization, invalid input, stable status/error contracts, and persistence calls without requiring a live database.
- For Prisma schema invariants that do not require a database, follow the existing file-based schema test. Use database-backed tests only when the behavior cannot be established at a cheaper boundary and the required environment is part of the task.
- Use E2E for critical behavior that depends on the assembled application and browser.

All three applications alias `server-only` in their Vitest configuration. Read the owning application's setup and mocks before relying on them. Hoist module mocks when Vitest import ordering requires it.

During development, run the owning workspace's test command, optionally with a file path accepted by Vitest. Before completion, run the root `npm test` and `npm run coverage` when the scope or user request calls for repository-wide verification. Report the commands actually run and any environmental limitation; do not infer coverage quality solely from a passing command because the repository does not define coverage thresholds.
