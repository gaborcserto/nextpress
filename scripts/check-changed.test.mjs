import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { selectChanges } from "./affected-workspaces.mjs";
import { localChanges, turboFilters } from "./check-changed.mjs";

test("CI installs dependencies before formatting and keeps detection dependency-free", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  const detection = workflow.split("  changes:")[1].split("  validate:")[0];
  assert.ok(detection.includes("run: node scripts/check-changed.mjs --ci"));
  assert.ok(!detection.includes("npm ci"));
  const validation = workflow
    .split("  validate:")[1]
    .split("  quality-gates:")[0];
  const install = validation.indexOf("run: npm ci");
  const format = validation.indexOf(
    "run: npm run format:check:changed -- --ci",
  );
  assert.ok(install !== -1 && format > install);
});

test("Quality Gates propagates upstream failures and permits only the expected validation result", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  const gates = workflow.split("  quality-gates:")[1];
  assert.ok(gates.includes("if: always()"));
  for (const job of ["changes", "validate", "dependency-audit"])
    assert.ok(gates.includes(`      - ${job}`));
  for (const expression of [
    "needs.changes.result",
    "needs.validate.result",
    "needs.changes.outputs.should_validate",
    "needs.dependency-audit.result",
  ])
    assert.ok(gates.includes(`\${{ ${expression} }}`));
  const match = / {8}run: \|\r?\n((?: {10}[^\n]*(?:\n|$))+)/.exec(gates);
  assert.ok(match, "Quality Gates shell script must be present");
  const script = match[1].replace(/^ {10}/gm, "");
  // Use Git's POSIX shell on Windows, where bash on PATH may launch WSL.
  const shell =
    process.platform === "win32"
      ? execFileSync("git", ["var", "GIT_SHELL_PATH"], {
          encoding: "utf8",
        }).trim()
      : "bash";
  for (const changes of ["success", "failure", "cancelled", "skipped"])
    for (const audit of ["success", "failure", "cancelled", "skipped"])
      for (const required of ["true", "false"])
        for (const validation of [
          "success",
          "failure",
          "cancelled",
          "skipped",
        ]) {
          const expected =
            changes === "success" &&
            audit === "success" &&
            validation === (required === "true" ? "success" : "skipped");
          const result = spawnSync(shell, ["-c", script], {
            env: {
              ...process.env,
              CHANGES_RESULT: changes,
              AUDIT_RESULT: audit,
              VALIDATE_REQUIRED: required,
              VALIDATE_RESULT: validation,
            },
            encoding: "utf8",
          });
          assert.ifError(result.error);
          assert.equal(
            result.status,
            expected ? 0 : 1,
            `${changes}/${audit}/${required}/${validation}: ${result.stderr}`,
          );
        }
});

test("one application selects its directory", () => {
  assert.deepEqual(turboFilters(selectChanges(["apps/web/src/app/page.tsx"])), [
    "--filter=...{./apps/web}",
  ]);
});

test("Turbo expands shared package changes to dependent applications", () => {
  const require = createRequire(import.meta.url);
  const output = execFileSync(
    process.execPath,
    [
      require.resolve("turbo/bin/turbo"),
      "run",
      "lint",
      "--dry=json",
      ...turboFilters(selectChanges(["packages/shared/src/index.ts"])),
    ],
    { encoding: "utf8" },
  );
  const { packages } = JSON.parse(output);
  for (const name of ["@nextpress/shared", "@nextpress/db", "web", "admin"])
    assert.ok(packages.includes(name), name);
});

for (const file of [
  "tsconfig.base.json",
  "package-lock.json",
  "package.json",
  "apps/unknown/index.ts",
  "scripts/new.mjs",
]) {
  test(`${file} falls back to full verification`, () =>
    assert.equal(selectChanges([file]).mode, "full"));
}

test("empty and Markdown-only local changes need no tasks", () => {
  assert.equal(selectChanges([]).mode, "none");
  assert.equal(selectChanges(["README.md", "apps/web/README.md"]).mode, "none");
});

for (const file of [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/README.md",
  ".agents/skills/nextpress-testing/SKILL.md",
]) {
  test(`${file} runs repository validation`, () =>
    assert.equal(selectChanges([file]).mode, "full"));
}

test("renames and deletions preserve both affected workspaces", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nextpress-rename-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8" });
  try {
    git("init", "--quiet");
    writeFileSync(path.join(directory, "old.ts"), "content");
    git("add", ".");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    );
    git("mv", "old.ts", "new.ts");
    assert.deepEqual(localChanges(git).sort(), ["new.ts", "old.ts"]);
    git("restore", "--staged", ".");
    git("add", "-A");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "rename fixture",
    );
    git("rm", "new.ts");
    assert.deepEqual(localChanges(git), ["new.ts"]);
    assert.deepEqual(
      turboFilters(selectChanges(["apps/admin/old.ts", "apps/web/new.ts"])),
      ["--filter=...{./apps/admin}", "--filter=...{./apps/web}"],
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("base selection includes committed branch work alongside local changes", () => {
  const calls = [];
  const runGit = (...args) => {
    calls.push(args);
    if (args[0] === "merge-base") return "ancestor\n";
    if (args.includes("ancestor")) return "apps/admin/committed.ts\0";
    if (args.includes("--cached")) return "apps/web/staged.ts\0";
    return "";
  };
  assert.deepEqual(localChanges(runGit, "origin/master").sort(), [
    "apps/admin/committed.ts",
    "apps/web/staged.ts",
  ]);
  assert.ok(
    calls.some((args) => args.join(" ") === "merge-base HEAD origin/master"),
  );
  assert.throws(
    () =>
      localChanges(() => {
        throw new Error("Git failed");
      }),
    /Git failed/,
  );
});

test("CI empty revision diff conservatively selects full verification", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nextpress-ci-"));
  const output = path.join(directory, "output");
  try {
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    // HEAD-to-HEAD exercises the conservative empty CI diff fallback.
    execFileSync(process.execPath, ["scripts/check-changed.mjs", "--ci"], {
      env: {
        ...process.env,
        BASE_SHA: head,
        HEAD_SHA: head,
        GITHUB_OUTPUT: output,
      },
    });
    assert.equal(
      readFileSync(output, "utf8"),
      "should_validate=true\nturbo_filters=\n",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CI revision selection emits the local workspace filters", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nextpress-ci-filters-"));
  const output = path.join(directory, "output");
  try {
    const base = execFileSync("git", ["rev-parse", "HEAD^"], {
      encoding: "utf8",
    }).trim();
    const files = execFileSync(
      "git",
      ["diff", "--name-only", "--no-renames", "-z", base, "HEAD"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean);
    let selection = selectChanges(files, { emptyIsFull: true });
    if (
      selection.mode === "affected" &&
      selection.directories.some(
        (directory) => !existsSync(`${directory}/package.json`),
      )
    ) {
      selection = selectChanges([], { full: true });
    }
    execFileSync(process.execPath, ["scripts/check-changed.mjs", "--ci"], {
      env: {
        ...process.env,
        BASE_SHA: base,
        HEAD_SHA: "HEAD",
        GITHUB_OUTPUT: output,
      },
    });
    assert.equal(
      readFileSync(output, "utf8"),
      `should_validate=${selection.mode !== "none"}\nturbo_filters=${turboFilters(selection).join(" ")}\n`,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CI empty diff, unavailable detection and explicit override select full verification", () => {
  assert.equal(selectChanges([], { emptyIsFull: true }).mode, "full");
  assert.equal(selectChanges([], { full: true }).mode, "full");
  assert.deepEqual(
    turboFilters(selectChanges(["apps/web/page.tsx"], { full: true })),
    [],
  );
});

test("Git collection includes staged, unstaged and untracked paths, including spaces", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nextpress-changes-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8" });
  try {
    git("init", "--quiet");
    writeFileSync(path.join(directory, "staged.ts"), "initial");
    git("add", ".");
    // Changing the same staged file must not hide either version's path.
    writeFileSync(path.join(directory, "staged.ts"), "updated");
    writeFileSync(path.join(directory, "untracked file.ts"), "new");
    writeFileSync(path.join(directory, ".gitignore"), "ignored.ts\n");
    git("add", ".gitignore");
    writeFileSync(path.join(directory, "ignored.ts"), "ignored");
    assert.deepEqual(localChanges(git).sort(), [
      ".gitignore",
      "staged.ts",
      "untracked file.ts",
    ]);
    // Even when unstaged content restores HEAD, the index still needs checking.
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    );
    writeFileSync(path.join(directory, "staged.ts"), "staged change");
    git("add", "staged.ts");
    writeFileSync(path.join(directory, "staged.ts"), "initial");
    assert.ok(localChanges(git).includes("staged.ts"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CI detection failure emits full verification outputs", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nextpress-fallback-"));
  const output = path.join(directory, "output");
  try {
    execFileSync(process.execPath, ["scripts/check-changed.mjs", "--ci"], {
      env: {
        ...process.env,
        BASE_SHA: "invalid-revision",
        GITHUB_OUTPUT: output,
      },
    });
    assert.equal(
      readFileSync(output, "utf8"),
      "should_validate=true\nturbo_filters=\n",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
