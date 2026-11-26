import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { selectChanges, selectCiChanges } from "./affected-workspaces.mjs";
import { formatFiles } from "./quality-files.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

const git = (...args) => {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status === 1 && args.includes("--quiet")) {
    return "";
  }

  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.stderr}`);
  }

  return result.stdout;
};

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

export function ciChanges(
  runGit,
  { BASE_SHA: base, HEAD_SHA: head, GITHUB_EVENT_NAME: event },
) {
  // An unavailable comparison is a known full scope. A failed diff is an error.
  if (!/^[a-f0-9]{40}$/i.test(head ?? "")) {
    throw new Error("CI selection requires the checked-out commit SHA");
  }

  const checkedOut = runGit("rev-parse", "HEAD").trim();

  if (checkedOut !== head) {
    throw new Error("CI head does not match the checked-out commit");
  }

  if (!/^[a-f0-9]{40}$/i.test(base ?? "")) {
    return null;
  }

  if (!runGit("rev-parse", "--verify", "--quiet", `${base}^{commit}`).trim()) {
    return null;
  }

  // PR validation runs against the synthetic merge, so its first parent must
  // be the event's base. Pushes compare endpoint trees, including force pushes.
  if (
    event === "pull_request" &&
    runGit("rev-parse", "--verify", "--quiet", `${head}^1`).trim() !== base
  ) {
    return null;
  }

  return paths(
    runGit("diff", "--name-only", "--no-renames", "-z", base, head, "--"),
  );
}

export function ciOutputs(selection) {
  return {
    scope: selection.mode,
    should_validate: selection.mode !== "none",
    should_validate_agents: selection.validateAgents,
    should_build: selection.build,
    should_integrate: selection.integration,
    turbo_filters:
      selection.mode === "affected"
        ? turboFilters(selection).join(" ")
        : selection.mode,
  };
}

function main() {
  const args = process.argv.slice(2);
  let base;
  const baseIndex = args.indexOf("--base");

  if (baseIndex !== -1) {
    base = args[baseIndex + 1];

    if (!base || base.startsWith("--")) {
      throw new Error("--base requires a revision");
    }

    args.splice(baseIndex, 2);
  }

  const filesIndex = args.indexOf("--files");
  const explicitFiles = filesIndex === -1 ? null : args.splice(filesIndex + 1);

  if (filesIndex !== -1) {
    args.splice(filesIndex, 1);
  }

  if (
    args.some(
      (arg) => !["--full", "--ci", "--format", "--format-check"].includes(arg),
    )
  ) {
    throw new Error(
      "Usage: check-changed.mjs [--full] [--base ref] [--format | --format-check] [--files paths...] [--ci]",
    );
  }

  const ci = args.includes("--ci");
  const formatOnly =
    args.includes("--format") || args.includes("--format-check");
  const write = args.includes("--format");

  if (write && args.includes("--format-check")) {
    throw new Error("Choose one formatting mode");
  }

  if (ci && (base || args.includes("--full"))) {
    throw new Error("--ci cannot be combined with local verification options");
  }

  if (write && (ci || args.includes("--full"))) {
    throw new Error("Formatting writes cannot use --ci or --full");
  }

  if (explicitFiles && (!formatOnly || ci || !explicitFiles.length)) {
    throw new Error(
      "--files requires a local format mode and at least one path",
    );
  }

  let files;
  let selection;

  if (ci) {
    files = ciChanges(git, process.env);

    if (formatOnly && files === null) {
      throw new Error("Cannot check formatting without a comparison revision");
    }

    selection = selectCiChanges(files ?? [], { full: files === null });
  } else {
    files =
      explicitFiles ??
      (args.includes("--full")
        ? paths(
            git("ls-files", "--cached", "--others", "--exclude-standard", "-z"),
          )
        : localChanges(git, base));
    selection = selectChanges(files, { full: args.includes("--full") });
  }

  if (
    selection.mode === "affected" &&
    selection.directories.some(
      (directory) =>
        !existsSync(new URL(`../${directory}/package.json`, import.meta.url)),
    )
  ) {
    selection = (ci ? selectCiChanges : selectChanges)([], { full: true });
  }

  console.log(`[check:changed] ${selection.mode}: ${selection.reason}`);

  if (ci && !formatOnly) {
    const outputs = Object.entries(ciOutputs(selection))
      .map(([name, value]) => `${name}=${value}\n`)
      .join("");
    appendFileSync(process.env.GITHUB_OUTPUT, outputs);

    return;
  }

  formatFiles(files, { cwd: root, write });

  if (formatOnly || selection.mode === "none") {
    return;
  }

  const npmCli = process.env.npm_execpath;

  if (!npmCli) {
    throw new Error("Run through npm run check:changed");
  }

  for (const script of [
    "lint:root",
    "typecheck:e2e",
    "check:changed:test",
    "agents:validate",
    "agents:test",
  ]) {
    const check = spawnSync(process.execPath, [npmCli, "run", script], {
      cwd: root,
      stdio: "inherit",
    });

    if (check.error) {
      throw check.error;
    }

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
      "--force",
      ...filters,
    ],
    { cwd: root, stdio: "inherit" },
  );

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
