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
setup or rendering when adding variants. Reuse an existing owner-local fixture or
render helper when it represents the same boundary. Keep defaults meaningful and
expose relevant overrides. Spell out exceptional setup such as provider-free
rendering, hydration, or a different authorization context. Promote support code
only when its consumers need the same contract and lifecycle. Name fixtures for
a recurring application state. Leave scenario-specific inputs, boundary values,
and expected results visible. After adding cases, revisit the suite's behavioral
groups and keep related behavior discoverable.

Assert observable outcomes such as accessible controls and text, resolved or
rejected results, HTTP contracts, or server-confirmed persisted state. Assertions
about calls are useful when the call is part of a boundary contract. Prefer
examples with explicit expected outcomes over recreating the production algorithm.
Use snapshots and structural assertions only when the captured details are part
of the contract. Where timing, order or multiplicity matters, assert the state
before the action, the exact side effect at the expected boundary, and the absence
of a duplicate after the next relevant action. Exercise a distinguishing input
or intermediate state so a test fails when the named handler is removed.
For a no-op, establish the original state and verify that it survives the
interaction, including relevant precision, metadata, or resolved identity.
Assert the absence of callbacks, requests, or writes at the boundary that owns
the side effect. When the parent accepts a controlled component's output, feed
it back as a prop if later interactions depend on that acknowledgement.

Await the specific observable completion signal. Use bounded polling of
observable state when the boundary exposes no completion signal. Control races
with deferred promises and use fake timers for behavior governed by clocks
such as expiry, debounce, and retry. Advance the relevant clock, flush pending
work with the runner or React's `act` as needed, and restore real timers.

Mock external boundaries with realistic responses and errors while preserving
the behavior under test. Restore mocks, timers, globals, environment, and shared
state and clean up rendered UI and resources. Register cleanup as soon as a
resource is acquired, before additional fixture setup can fail. Restore original
property descriptors and environment values when replacing existing state. Share
setup only when mutable state is reset and each case can run independently.

Use fixed instants, explicit timezones and locales, and literal expected values
when those inputs affect the contract. Control only the clock needed for the
scenario. For UI timezone tests, keep resolution tables in the pure utility
suite and test how the UI validates or commits the result.

### Review coverage and cost

Before consolidating or removing a test, record the original regression, the
surviving test, and evidence that the survivor fails for the same regression.
Compare initial state, input representation, event path, intermediate state and
side effects. A shared result can conceal different regressions, such as creating
from empty state, editing an existing value or reselecting it. Use parameterized
cases when the setup and assertions genuinely align. Exercise distinct dismissal,
validation and confirmation paths when they establish different behavior.
Distinguish a usable default when context is absent from explicitly unavailable
state.
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
Distinguish assertion, probe, and overall test or startup deadlines. Measure both
per-case and whole-file cost when splitting an expensive test. Use
[verification guidance](../nextpress-verification/SKILL.md) to report historical
failures that remain unresolved.

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
- For React UI, use React Testing Library through the owning app's jsdom setup.
  Prefer accessible roles, names, and labels. Scope lookups to a dialog, region,
  or form when that scope identifies the intended control. Prefer semantic
  identity over incidental position. Use synchronous assertions for synchronous
  effects and choose an interaction API that exercises the relevant behavior.
- API-specific: for route behavior, exercise exported route handlers with `Request` objects and mock external boundaries such as Prisma, hashing, and authentication. Cover authorization, invalid input, stable status/error contracts, and persistence calls without requiring a live database.
- For Prisma schema invariants that do not require a database, follow the existing file-based schema test. Use database-backed tests only when the behavior cannot be established at a cheaper boundary and the required environment is part of the task.
- Use E2E for critical behavior that depends on the assembled application and browser.

All three applications alias `server-only` in their Vitest configuration. Read the owning application's setup and mocks before relying on them. Hoist module mocks when Vitest import ordering requires it.

During development, run the owning workspace's test command, optionally with a file path accepted by Vitest. Before completion, run the root `npm test` and `npm run coverage` when the scope or user request calls for repository-wide verification. Report the commands actually run and any environmental limitation; do not infer coverage quality solely from a passing command because the repository does not define coverage thresholds.
