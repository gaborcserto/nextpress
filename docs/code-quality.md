# Code quality checks

Use npm 12.2.2 and Node 24 from the repository root. ESLint checks correctness,
imports and framework rules with zero warnings; TypeScript checks types; Oxfmt
0.78.0 owns formatting. Do not add a second formatter or enable import sorting
in Oxfmt. The shared lint presets retain Next Core Web Vitals, Hooks and workspace
boundary restrictions.

```sh
npm run format:changed
npm run format:check:changed
npm run check:changed
npm run check:changed -- --base origin/master
```

Local selection includes staged, unstaged and nonignored new files. `--base`
also includes committed changes since the merge base. Renames include both paths;
deleted files affect workspace selection but cannot be formatted. Turbo expands
dependent workspaces. Detection failures fail, and formatting never falls back to
a whole-repository write. `check:changed -- --full` expands workspace checks,
while formatting remains limited to changed files.

When unrelated user edits exist, select task-owned paths explicitly:

```sh
npm run format:changed -- --files "apps/admin/src/example file.ts"
```

Oxfmt checks/writes entire selected source/style/config files (JS/JSX/MJS/CJS,
TS/TSX/MTS/CTS, CSS/SCSS, JSON/JSONC and YAML). Markdown and Prisma files are outside
this formatter scope. Root `.oxfmtrc.json` excludes generated output, dependencies,
public/vendor assets, migrations, lockfiles and internal notes. Untouched legacy
files are not required to be reformatted; changing formatter policy requires
compatibility fixtures and deliberate review of the resulting changed-file diff.

Husky runs lint-staged, which formats supported staged files and lints source
using its owning ESLint config. It preserves partially staged edits using
lint-staged's standard hiding/restoration behavior; no Git staging command belongs
in the formatter runner. CI checks the same root configuration without writes,
using its existing BASE_SHA/HEAD_SHA range and workspace selector. Existing tests,
coverage, builds, Prisma validation and security checks remain in CI.

```sh
npm run agents:validate
npm run agents:test
npm run check:changed:test
```

The integration tests deliberately reject malformed formatting and lint fixtures,
check supported languages/stability, untouched and ignored files, invalid refs,
base-revision selection, and partial staging with filenames containing spaces.

## Import paths

Prefer relative imports within the same component/feature, including colocated
types, hooks, styles and sibling modules. Across boundaries, use the target's
explicit public entry: an existing component index such as
`@/ui/components/EmailField`, or a public file such as
`@/components/public-ui/Container`. An index file is not required for every public
module. Do not introduce barrels merely to shorten paths or automatically route
local imports through `@/ui/components`.

Existing broad barrel consumers remain supported; new imports should use the
narrowest appropriate public module. Implementations must avoid their own index
and ancestor barrels that re-export them. Admin ESLint rejects static imports/re-exports of a UI section's own
alias umbrella from inside that section, including explicit index paths. Relative
ancestor imports, other cycles and appropriate public APIs require review; alias
grouping is not cycle detection. No TypeScript aliases or public-app boundary
restrictions are changed by this policy.

Preserve Server/Client Component directives, server-only boundaries, type-only
imports and side-effect order. IDE path-shortening suggestions are optional
refactoring hints. See the mandatory
[import-path conventions](../.agents/skills/nextpress-readability/references/source-conventions.md#import-paths-and-public-entry-points)
for examples and review criteria.

## Agent instructions

Read [AGENTS.md](../AGENTS.md) and the mandatory
[readability skill](../.agents/skills/nextpress-readability/SKILL.md) before source
edits. Review the full task diff against selected skills before delivery. Passing
formatting, lint and type checks does not prove cohesive responsibilities or
appropriate architecture.

Codex discovers repository `.agents/skills` metadata; selected skill bodies still
need to be read. See [Codex skills](https://learn.chatgpt.com/docs/build-skills).
Claude's minimal `CLAUDE.md` uses the documented `@AGENTS.md` import and then reads
the same selected skill files explicitly, rather than duplicating them into
`.claude/skills`. See [Claude instructions](https://code.claude.com/docs/en/memory)
and [native Claude skills](https://code.claude.com/docs/en/skills).

These mechanisms are documented and resource links are tested; a validator cannot
prove a fresh agent followed instructions. For a runtime activation check, start
fresh Codex and Claude sessions with an ordinary TSX edit request, record reads of
AGENTS/readability/React/verification, inspect the final diff, and verify formatting
and lint failures are caught. Claude's `/context all` can confirm loaded memory
files. Record unavailable runtime evidence explicitly.
