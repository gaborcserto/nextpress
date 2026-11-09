import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { selectChanges } from './affected-workspaces.mjs';
import { localChanges, turboFilters } from './check-changed.mjs';

test('one application selects its directory', () => {
  assert.deepEqual(turboFilters(selectChanges(['apps/web/src/app/page.tsx'])), ['--filter=...{./apps/web}']);
});

test('Turbo expands shared package changes to dependent applications', () => {
  const require = createRequire(import.meta.url);
  const output = execFileSync(process.execPath, [require.resolve('turbo/bin/turbo'), 'run', 'lint', '--dry=json', ...turboFilters(selectChanges(['packages/shared/src/index.ts']))], { encoding: 'utf8' });
  const { packages } = JSON.parse(output);
  for (const name of ['@nextpress/shared', '@nextpress/db', 'web', 'admin']) assert.ok(packages.includes(name), name);
});

for (const file of ['tsconfig.base.json', 'package-lock.json', 'package.json', 'apps/unknown/index.ts', 'scripts/new.mjs']) {
  test(`${file} falls back to full verification`, () => assert.equal(selectChanges([file]).mode, 'full'));
}

test('empty and Markdown-only local changes need no tasks', () => {
  assert.equal(selectChanges([]).mode, 'none');
  assert.equal(selectChanges(['README.md', 'apps/web/README.md']).mode, 'none');
});

test('CI empty diff, unavailable detection and explicit override select full verification', () => {
  assert.equal(selectChanges([], { emptyIsFull: true }).mode, 'full');
  assert.equal(selectChanges([], { full: true }).mode, 'full');
  assert.deepEqual(turboFilters(selectChanges(['apps/web/page.tsx'], { full: true })), []);
});

test('Git collection includes staged, unstaged and untracked paths, including spaces', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nextpress-changes-'));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  try {
    git('init', '--quiet');
    writeFileSync(path.join(directory, 'staged.ts'), 'initial');
    git('add', '.');
    // Changing the same staged file must not hide either version's path.
    writeFileSync(path.join(directory, 'staged.ts'), 'updated');
    writeFileSync(path.join(directory, 'untracked file.ts'), 'new');
    assert.deepEqual(localChanges(git).sort(), ['staged.ts', 'untracked file.ts']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('CI detection failure emits full verification outputs', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nextpress-fallback-'));
  const output = path.join(directory, 'output');
  try {
    execFileSync(process.execPath, ['scripts/check-changed.mjs', '--ci'], {
      env: { ...process.env, BASE_SHA: 'invalid-revision', GITHUB_OUTPUT: output },
    });
    assert.equal(readFileSync(output, 'utf8'), 'should_validate=true\nturbo_filters=\n');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
