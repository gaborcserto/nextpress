// Shared CI/local path policy. Turbo owns workspace dependency expansion.
export function selectChanges(files, { full = false, emptyIsFull = false } = {}) {
  if (full) return { mode: 'full', reason: 'Full verification requested or change detection unavailable.' };
  if (!files.length) return { mode: emptyIsFull ? 'full' : 'none', reason: 'No changed files.' };
  const directories = new Set();
  for (const file of files) {
    if (file === 'AGENTS.md' || file.startsWith('.agents/')) return { mode: 'full', reason: 'Agent instructions or resources changed.' };
    if (file.endsWith('.md')) continue;
    const directory = /^(apps\/(?:web|admin)|packages\/(?:db|shared|eslint-config))\//.exec(file)?.[1];
    if (!directory) return { mode: 'full', reason: `Root configuration or unknown path: ${file}` };
    directories.add(directory);
  }
  return directories.size
    ? { mode: 'affected', directories: [...directories].sort(), reason: 'Changed workspaces and their Turbo dependents.' }
    : { mode: 'none', reason: 'Only Markdown changed.' };
}
