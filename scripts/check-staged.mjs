import { ESLint } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatFiles } from "./quality-files.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = process.argv.slice(2);
formatFiles(files, { cwd: root, write: true });
let failed = false;
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
  if (output) console.log(output);
  failed ||= results.some(
    (result) => result.errorCount > 0 || result.warningCount > 0,
  );
}
if (failed) process.exitCode = 1;
