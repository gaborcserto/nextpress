# Source readability conventions

- Imports: external and workspace packages first, app aliases second, relatives last, with one blank line between groups. Follow ESLint ordering/type-import policy. Preserve directives, side-effect import order and CSS cascade; do not blindly sort or delete potentially effectful imports.
- State/hooks: group related state and refs, derived setup, effects, handlers and render where dependencies allow. Preserve hook execution order. Separate independent effects and meaningful stages without spacing every declaration.
- Functions/methods: separate independent functions, function-valued declarations and methods with a blank line. Keep overloads together and comments attached. Prefer descriptive names and focused responsibilities; extract helpers only when they clarify meaningful work. Avoid ambiguous boolean arguments and unnecessary one-line helpers.
- Control flow: always use braces for `if`, `else`, loops and similar statement bodies, including single-line guards. Prefer early returns; omit unnecessary `else` after an unconditional return. Avoid deeply nested conditional expressions; use explicit blocks for multi-step branches. Preserve evaluation order.
- JSX: name handlers containing multiple state updates, storage or substantial branching. Trivial argument forwarding can stay inline. Keep semantic groups visible without spacer nodes or changing whitespace-sensitive text.
- Cohesion: keep functions/components focused on a recognizable responsibility. Reuse owning-app primitives and colocate private logic. Small local extractions may clarify repeated work; avoid generic frameworks, extra providers, wrapper layers and speculative hooks.
- Types: use named aliases for repeated schema-derived types or complex component props. Preserve type-only import conventions, strict typing and boundary validation; avoid `any` and unnecessary assertions.
- Errors: distinguish validation, transport and domain failures. Use operation-specific action labels and success/error messages; retain useful safe error context and optimistic concurrency handling. Do not silently swallow failures. Keep cleanup in `finally` when needed.
- Formatting: accept root Oxfmt layout, retaining logical blank lines it permits. Do not fight it with ignore directives or manual alignment. Check second-pass stability when introducing conventions.
- Boundaries: preserve App Router special files, Server/Client directives, server-only dependencies and authorization. Do not impose universal barrels or client directives to normalize structure.

## Logical grouping

For maintained JavaScript, TypeScript, JSX and TSX, separate distinct stages with
blank lines: guards, state setup/updates, data preparation, requests, response
validation, result processing, error handling and returns where separation helps.
Keep tightly related statements together; do not space every declaration or setter.
Always add a blank line before `try` when setup precedes it, and separate the
`try/catch/finally` block from subsequent independent work.

```tsx
setBusy(true);
setMessage("");

try {
  await saveRevision();
} catch (error) {
  handleError(error);
} finally {
  setBusy(false);
}
```

Review grouping alongside Oxfmt and ESLint; formatting alone cannot infer intent.
Apply these conventions to task-owned edits, without unrelated repository-wide rewrites.

Passing mechanical checks does not prove meaningful naming, logical grouping, appropriate extraction or cohesive architecture. Review the complete task diff and report specific contextual exceptions with reasons.

## Import paths and public entry points

Use relative imports for files within the same component or feature directory:
`./EmailField.types`, `./SignInFormFooter` and `./PostList` describe local ownership.
An alias is not an instruction to replace those paths with an umbrella import.

Across component/feature boundaries, prefer the owning module's explicit public
entry point. Reuse a component-level index when it already exists, such as
`@/ui/components/EmailField`. Where there is no index, a public module file such as
`@/components/public-ui/Container` is the entry point. A neighboring feature's
relative public entry is also valid; prefer an application alias over long parent
chains when it makes ownership clearer. Do not reach through an entry point into
another feature's private hooks, types or implementation files.

Do not add index/barrel files solely to shorten paths. Existing broad public
barrels can remain where their API is intentionally appropriate; prefer narrower
module entry points for new cross-boundary imports. Do not migrate existing
consumers or reorganize files as incidental cleanup.

An implementation must not import through its own public index or an ancestor
umbrella that re-exports it. That can form a cycle and couple otherwise independent
modules. Trace relevant re-exports and dependency direction before changing paths;
shorter spelling does not establish a safe dependency. Admin lint rejects static imports/re-exports
of a UI section's own `@/ui/components`, `@/ui/primitives` or `@/ui/shell` umbrella
from inside that section, including explicit index spellings. Relative ancestor
barrels and other cycles still need contextual review; this guard is not a complete
cycle detector.

Preserve `"use client"`, `"use server"`, `server-only`, type-only imports and
side-effect ordering. A barrel does not make a server module client-safe. Avoid
mixing server-only data access and client UI in a common entry point, and do not
add a directive to a barrel to disguise an invalid import.

Both applications' existing `@/*` aliases resolve within their own `src` directory.
ESLint's `import/order` groups alias imports but does not choose a path for you or
prove that its exports are safe. Do not add a universal relative-import ban,
alias-to-barrel autofix or cycle rule without reliable TypeScript alias resolution.
Treat WebStorm/WebStorm-family IDE import-shortening suggestions as optional
refactoring hints, not required quality fixes. Review the module boundary first.
