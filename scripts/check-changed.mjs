import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { selectChanges } from "./affected-workspaces.mjs";
import { formatFiles } from "./quality-files.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const paths = (output) => output.split("\0").filter(Boolean);

export function localChanges(runGit = git, base) {
  // Separate diffs retain staged changes even when the worktree undoes them.
  return [
    ...new Set([
      ...paths(runGit("diff", "--cached", "--name-only", "--no-renames", "-z")),
      ...paths(runGit("diff", "--name-only", "--no-renames", "-z")),
      ...paths(runGit("ls-files", "--others", "--exclude-standard", "-z")),
      ...(base
        ? paths(
            runGit(
              "diff",
              "--name-only",
              "--no-renames",
              "-z",
              runGit("merge-base", "HEAD", base).trim(),
              "HEAD",
            ),
          )
        : []),
    ]),
  ];
}

export function turboFilters(selection) {
  return selection.mode === "affected"
    ? selection.directories.map((directory) => `--filter=...{./${directory}}`)
    : [];
}

function main() {
  const args = process.argv.slice(2);
  let base;
  const baseIndex = args.indexOf("--base");

  if (baseIndex !== -1) {
    base = args[baseIndex + 1];
    if (!base || base.startsWith("--"))
      throw new Error("--base requires a revision");
    args.splice(baseIndex, 2);
  }
  const filesIndex = args.indexOf("--files");
  const explicitFiles = filesIndex === -1 ? null : args.splice(filesIndex + 1);

  if (filesIndex !== -1) args.splice(filesIndex, 1);
  if (
    args.some(
      (arg) => !["--full", "--ci", "--format", "--format-check"].includes(arg),
    )
  )
    throw new Error(
      "Usage: check-changed.mjs [--full] [--base ref] [--format | --format-check] [--files paths...] [--ci]",
    );
  const ci = args.includes("--ci");
  const formatOnly =
    args.includes("--format") || args.includes("--format-check");
  const write = args.includes("--format");

  if (write && args.includes("--format-check"))
    throw new Error("Choose one formatting mode");
  if (ci && base) throw new Error("CI uses BASE_SHA/HEAD_SHA, not --base");
  if (write && (ci || args.includes("--full")))
    throw new Error("Formatting writes cannot use --ci or --full");
  if (explicitFiles && (!formatOnly || ci || !explicitFiles.length))
    throw new Error(
      "--files requires a local format mode and at least one path",
    );
  let files;
  let selection;

  try {
    if (ci) {
      const ciBase = process.env.BASE_SHA;

      if (!ciBase) throw new Error("Missing base revision");
      git("cat-file", "-e", `${ciBase}^{commit}`);
      files = paths(
        git(
          "diff",
          "--name-only",
          "--no-renames",
          "-z",
          ciBase,
          process.env.HEAD_SHA || "HEAD",
        ),
      );
      selection = selectChanges(files, { emptyIsFull: true });
    } else {
      files = explicitFiles ?? localChanges(git, base);
      selection = selectChanges(files, { full: args.includes("--full") });
    }
    if (
      selection.mode === "affected" &&
      selection.directories.some(
        (directory) =>
          !existsSync(
            new URL(
              `${directory}/package.json`,
              new URL("../", import.meta.url),
            ),
          ),
      )
    ) {
      selection = {
        mode: "full",
        reason:
          "A changed workspace manifest is missing; scope cannot be resolved safely.",
      };
    }
  } catch (error) {
    // Only the output-only CI selector retains conservative full validation.
    // A formatter must never turn detection failure into an empty success/write.
    if (!ci || formatOnly) throw error;
    selection = selectChanges([], { full: true });
  }
  console.log(`[check:changed] ${selection.mode}: ${selection.reason}`);
  if (ci && !formatOnly) {
    const filter = turboFilters(selection).join(" ");
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `should_validate=${selection.mode !== "none"}\nturbo_filters=${filter}\n`,
    );

    return;
  }
  formatFiles(files, { cwd: root, write });
  if (formatOnly || selection.mode === "none") return;
  const npmCli = process.env.npm_execpath;

  if (!npmCli) throw new Error("Run through npm run check:changed");
  for (const script of [
    "lint:root",
    "check:changed:test",
    "agents:validate",
    "agents:test",
  ]) {
    const check = spawnSync(process.execPath, [npmCli, "run", script], {
      cwd: root,
      stdio: "inherit",
    });

    if (check.error) throw check.error;
    if (check.status !== 0) {
      process.exitCode = check.status ?? 1;

      return;
    }
  }
  const filters = turboFilters(selection);
  console.log(
    `[check:changed] turbo run lint typecheck test ${filters.join(" ") || "(all workspaces)"}`,
  );
  const require = createRequire(import.meta.url);
  const result = spawnSync(
    process.execPath,
    [
      require.resolve("turbo/bin/turbo"),
      "run",
      "lint",
      "typecheck",
      "test",
      ...filters,
    ],
    { cwd: root, stdio: "inherit" },
  );

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
