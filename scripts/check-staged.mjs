import { ESLint } from "eslint";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { styleText } from "node:util";

import { formatFiles } from "./quality-files.mjs";
import { inspectFiles } from "./readability.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

export async function checkStaged(
  inputFiles,
  { log = console.log, verbose = false } = {},
) {
  const files = [
    ...new Set(inputFiles.map((file) => path.resolve(root, file))),
  ];
  const started = performance.now();
  let failed = true;

  try {
    log(
      "[check:staged] Oxfmt formatting; ESLint quality and readability checks",
    );
    const readability = inspectFiles(files, { cwd: root, log, verbose });
    formatFiles(files, { cwd: root, write: true, log, verbose });
    let hasFailures = readability.violations > 0 || readability.errors > 0;
    const groups = new Map();

    for (const file of files.filter((file) => /\.[cm]?[jt]sx?$/.test(file))) {
      // Resolve the owning config rather than duplicating the workspace path map.
      const discovery = new ESLint({ cwd: path.dirname(path.resolve(file)) });
      const config = await discovery.findConfigFile(file);

      if (!config) throw new Error(`No ESLint configuration for ${file}`);
      const group = groups.get(config) ?? [];
      group.push(file);
      groups.set(config, group);
    }
    for (const [config, group] of groups) {
      const eslint = new ESLint({ cwd: path.dirname(config) });
      const selected = [];

      for (const file of group)
        if (!(await eslint.isPathIgnored(file))) selected.push(file);
      if (!selected.length) continue;
      const results = await eslint.lintFiles(selected);
      const formatter = await eslint.loadFormatter("stylish");
      const output = formatter.format(results);

      if (output) log(output);
      hasFailures ||= results.some(
        (result) => result.errorCount > 0 || result.warningCount > 0,
      );
    }

    failed = hasFailures;

    return !failed;
  } finally {
    const elapsed = ((performance.now() - started) / 1000).toFixed(2);
    const indicator = styleText(
      failed ? "red" : "green",
      failed ? "\u2716" : "\u2714",
    );
    log(
      `${indicator} Staged checks: ${files.length} files processed in ${elapsed}s (${failed ? "failed" : "passed"}).`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const verbose = args[0] === "--verbose";
  process.exitCode = (await checkStaged(verbose ? args.slice(1) : args, {
    verbose,
  }))
    ? 0
    : 1;
}
