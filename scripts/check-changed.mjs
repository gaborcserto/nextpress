import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { selectChanges } from './affected-workspaces.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const paths = (output) => output.split('\0').filter(Boolean);

export function localChanges(runGit = git) {
  // Separate diffs retain staged changes even when the worktree undoes them.
  return [...new Set([
    ...paths(runGit('diff', '--cached', '--name-only', '--no-renames', '-z')),
    ...paths(runGit('diff', '--name-only', '--no-renames', '-z')),
    ...paths(runGit('ls-files', '--others', '--exclude-standard', '-z')),
  ])];
}

export function turboFilters(selection) {
  return selection.mode === 'affected'
    ? selection.directories.map((directory) => `--filter=...{./${directory}}`)
    : [];
}

function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--full', '--ci'].includes(arg))) throw new Error('Usage: check-changed.mjs [--full | --ci]');
  const ci = args.includes('--ci');
  let selection;
  try {
    if (ci) {
      const base = process.env.BASE_SHA;
      if (!base) throw new Error('Missing base revision');
      git('cat-file', '-e', `${base}^{commit}`);
      selection = selectChanges(paths(git('diff', '--name-only', '--no-renames', '-z', base, process.env.HEAD_SHA || 'HEAD')), { emptyIsFull: true });
    } else {
      selection = selectChanges(localChanges(), { full: args.includes('--full') });
      if (selection.mode === 'affected' && selection.directories.some((directory) => !existsSync(new URL(`${directory}/package.json`, new URL('../', import.meta.url))))) {
        selection = { mode: 'full', reason: 'A changed workspace manifest is missing; scope cannot be resolved safely.' };
      }
    }
  } catch {
    selection = selectChanges([], { full: true });
  }
  console.log(`[check:changed] ${selection.mode}: ${selection.reason}`);
  if (ci) {
    // Preserve CI's revision filter and output contract.
    const filter = selection.mode === 'affected' ? `--filter=...[${process.env.BASE_SHA}]` : '';
    appendFileSync(process.env.GITHUB_OUTPUT, `should_validate=${selection.mode !== 'none'}\nturbo_filters=${filter}\n`);
    return;
  }
  if (selection.mode === 'none') return;
  const filters = turboFilters(selection);
  console.log(`[check:changed] turbo run lint typecheck test ${filters.join(' ') || '(all workspaces)'}`);
  const require = createRequire(import.meta.url);
  const result = spawnSync(process.execPath, [require.resolve('turbo/bin/turbo'), 'run', 'lint', 'typecheck', 'test', ...filters], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
