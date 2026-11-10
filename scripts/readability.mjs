import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { boundaries, format } from "./readability-core.mjs";

export function inspectFiles(
  files,
  {
    cwd = process.cwd(),
    write = false,
    verbose = false,
    log = console.log,
  } = {},
) {
  let inspected = 0;
  let violations = 0;
  let filesWithViolations = 0;
  let errors = 0;

  for (const file of [...new Set(files)]) {
    const normalized = file.replaceAll("\\", "/");

    if (
      !/\.[cm]?[jt]sx?$/.test(normalized) ||
      /(^|\/)(node_modules|\.next|dist|build|coverage|generated|vendor|migrations|public|\.notes|\.references)\//.test(
        normalized,
      )
    )
      continue;
    const absolute = path.resolve(cwd, file);

    try {
      if (!statSync(absolute).isFile()) continue;
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    inspected++;
    const text = readFileSync(absolute, "utf8");

    try {
      const gaps = boundaries(text, file);
      violations += gaps.length;
      if (gaps.length) filesWithViolations++;
      if (write && gaps.length) writeFileSync(absolute, format(text, file));
      else if (verbose)
        for (const gap of gaps) {
          const line = text.slice(0, gap.end).split("\n").length;
          log(
            `${file}:${line}: readability/spacing: Expected one blank line at this boundary. Run node scripts/readability.mjs --write --files "${file}" then Oxfmt.`,
          );
        }
    } catch (error) {
      errors++;
      log(
        `${file}:${error.line ?? 1}:${error.column ?? 1}: readability/parse: ${error.message}`,
      );
    }
  }
  log(
    `Inspected ${inspected} source files; ${violations} readability violations in ${filesWithViolations} files${write ? " repaired" : ""}; ${errors} parse errors.`,
  );

  if (violations && !write)
    log(
      "Autofix: node scripts/readability.mjs --write (then npm run format:changed). Details: node scripts/readability.mjs --verbose",
    );

  return { inspected, filesWithViolations, violations, errors };
}

function main() {
  const args = process.argv.slice(2);
  const explicit = args.indexOf("--files");
  const options = explicit === -1 ? args : args.slice(0, explicit);

  if (
    options.some((arg) => !["--write", "--verbose"].includes(arg)) ||
    (explicit !== -1 && !args.slice(explicit + 1).length)
  )
    throw new Error(
      "Usage: readability.mjs [--write] [--verbose] [--files paths...]",
    );
  const files =
    explicit === -1
      ? execFileSync(
          "git",
          ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
          { encoding: "utf8" },
        ).split("\0")
      : args.slice(explicit + 1);
  const result = inspectFiles(files, {
    write: options.includes("--write"),
    verbose: options.includes("--verbose"),
  });
  process.exitCode =
    result.errors || (!options.includes("--write") && result.violations)
      ? 1
      : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
