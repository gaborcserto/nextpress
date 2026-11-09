import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const formatter = path.join(
  path.dirname(require.resolve("oxfmt/package.json")),
  "bin/oxfmt",
);

export function formatFiles(files, { cwd, write = false } = {}) {
  const selected = [...new Set(files)].filter((file) => {
    if (!/\.(?:[cm]?[jt]sx?|css|scss|jsonc?|ya?ml)$/.test(file)) return false;
    try {
      return statSync(path.resolve(cwd, file)).isFile();
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  });
  // Without paths the CLI targets cwd. Never allow that implicit full write.
  for (let offset = 0; offset < selected.length; offset += 20) {
    const result = spawnSync(
      process.execPath,
      [
        formatter,
        "--config",
        path.join(cwd, ".oxfmtrc.json"),
        "--disable-nested-config",
        write ? "--write" : "--check",
        ...selected
          .slice(offset, offset + 20)
          .map((file) => path.resolve(cwd, file)),
      ],
      { cwd, stdio: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(
        `Formatting ${write ? "write" : "check"} failed (${result.status}).`,
      );
  }
  return selected;
}
