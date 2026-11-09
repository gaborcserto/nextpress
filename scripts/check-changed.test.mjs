import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
    assert.deepEqual(localChanges(git).sort(), [
      "staged.ts",
      "untracked file.ts",
    ]);
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
