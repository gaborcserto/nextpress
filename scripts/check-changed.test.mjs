import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { selectChanges, selectCiChanges } from "./affected-workspaces.mjs";
import {
  ciChanges,
  ciOutputs,
  localChanges,
  turboFilters,
} from "./check-changed.mjs";

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
  const format = validation.indexOf("run: npm run format:check");
  assert.ok(install !== -1 && format > install);
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

  for (const name of ["@nextpress/shared", "@nextpress/db", "web", "admin"]) {
    assert.ok(packages.includes(name), name);
  }
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

test("empty and documentation-only changes need no application tasks", () => {
  assert.equal(selectChanges([]).mode, "none");

  for (const file of [
    "README.md",
    "apps/web/README.md",
    "packages/db/README.md",
    "docs/development.md",
    "docs/images/architecture.svg",
  ]) {
    assert.equal(selectChanges([file]).mode, "none", file);
  }

  assert.equal(
    selectChanges(["README.md", "apps/web/src/app/page.tsx"]).mode,
    "affected",
  );
});

test("unknown documentation assets and executable docs configuration fail safe", () => {
  for (const file of ["docs/generator.mjs", ".github/workflows/ci.yml"]) {
    assert.equal(selectChanges([file]).mode, "full", file);
  }

  assert.equal(selectChanges([".agents/README.json"]).validateAgents, true);
});

for (const file of [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/README.md",
  ".agents/skills/nextpress-testing/SKILL.md",
]) {
  test(`${file} runs agent-resource validation without app selection`, () => {
    const selection = selectChanges([file]);
    assert.equal(selection.mode, "none");
    assert.equal(selection.validateAgents, true);
  });
}

test("agent instructions plus app source require both relevant validations", () => {
  const selection = selectChanges([
    "AGENTS.md",
    "apps/admin/src/components/example.tsx",
  ]);
  assert.equal(selection.mode, "affected");
  assert.equal(selection.validateAgents, true);
  assert.deepEqual(selection.directories, ["apps/admin"]);
});

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

    if (args[0] === "merge-base") {
      return "ancestor\n";
    }

    if (args.includes("ancestor")) {
      return "apps/admin/committed.ts\0";
    }

    if (args.includes("--cached")) {
      return "apps/web/staged.ts\0";
    }

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
      "scope=full\nshould_validate=true\nshould_validate_agents=true\nshould_build=true\nshould_integrate=true\nturbo_filters=full\n",
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
    const expected = ciOutputs(selectCiChanges(files));
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();

    execFileSync(process.execPath, ["scripts/check-changed.mjs", "--ci"], {
      env: {
        ...process.env,
        BASE_SHA: base,
        HEAD_SHA: head,
        GITHUB_OUTPUT: output,
      },
    });
    assert.equal(
      readFileSync(output, "utf8"),
      Object.entries(expected)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(""),
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

test("CI invalid base emits full verification outputs", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nextpress-fallback-"));
  const output = path.join(directory, "output");

  try {
    execFileSync(process.execPath, ["scripts/check-changed.mjs", "--ci"], {
      env: {
        ...process.env,
        BASE_SHA: "invalid-revision",
        HEAD_SHA: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        GITHUB_OUTPUT: output,
      },
    });
    assert.equal(
      readFileSync(output, "utf8"),
      "scope=full\nshould_validate=true\nshould_validate_agents=true\nshould_build=true\nshould_integrate=true\nturbo_filters=full\n",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("API changes select the API workspace without dependency installation", () => {
  assert.deepEqual(
    selectChanges(["apps/api/src/app/api/health/route.ts"]).directories,
    ["apps/api"],
  );
});

test("CI database integrations use the ownership-verifying runner in the API cwd", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );

  for (const family of ["content", "security"]) {
    assert.ok(
      workflow.includes(
        `working-directory: apps/api\n        run: npx tsx scripts/b04-postgres.ts ${family}`,
      ),
    );
  }

  assert.ok(!workflow.includes("createdb"));
  assert.ok(!workflow.includes("bootstrap:admin"));
});

const scenarios = [
  [
    "Admin unit test",
    [
      "apps/admin/src/ui/components/PublicationDatePicker/publication-time.test.ts",
    ],
    "apps/admin",
    false,
    false,
  ],
  [
    "Admin component test",
    ["apps/admin/src/components/admin/PrivateDraftBoundary.test.tsx"],
    "apps/admin",
    false,
    false,
  ],
  [
    "Admin CSS",
    ["apps/admin/src/components/admin/SettingsScreen/SettingsTabs.module.css"],
    "apps/admin",
    true,
    false,
  ],
  [
    "Admin business logic",
    ["apps/admin/src/lib/api/client.ts"],
    "apps/admin",
    true,
    true,
  ],
  [
    "Web display component",
    ["apps/web/src/components/public-content/GalleryEmpty.tsx"],
    "apps/web",
    true,
    false,
  ],
  [
    "Web rendering",
    ["apps/web/src/app/live-preview/page.tsx"],
    "apps/web",
    true,
    true,
  ],
  [
    "API mocked contract test",
    ["apps/api/src/lib/api/openapi.test.ts"],
    "apps/api",
    false,
    false,
  ],
  [
    "API service",
    ["apps/api/src/lib/services/content.ts"],
    "apps/api",
    true,
    true,
  ],
  [
    "authentication",
    ["apps/api/src/lib/auth/session.ts"],
    "apps/api",
    true,
    true,
  ],
  [
    "media upload",
    ["apps/api/src/app/api/admin/media/upload/route.ts"],
    "apps/api",
    true,
    true,
  ],
  ["DB schema", ["packages/db/prisma/schema.prisma"], "*", true, true],
  [
    "migration",
    ["packages/db/prisma/migrations/new/migration.sql"],
    "*",
    true,
    true,
  ],
  [
    "shared contract",
    ["packages/shared/src/index.ts"],
    "packages/shared",
    true,
    true,
  ],
  [
    "shared utility",
    ["packages/shared/src/time.ts"],
    "packages/shared",
    true,
    true,
  ],
  ["root config", ["tsconfig.base.json"], "*", true, true],
  ["lockfile", ["package-lock.json"], "*", true, true],
  ["workflow", [".github/workflows/ci.yml"], "*", true, true],
  ["selector", ["scripts/check-changed.mjs"], "*", true, true],
  ["documentation", ["docs/development.md"], "", false, false],
  ["agent resource", ["AGENTS.md"], "", false, false],
  [
    "mixed test and source",
    ["apps/admin/src/ui/a.test.ts", "apps/api/src/lib/auth/session.ts"],
    "apps/admin apps/api",
    true,
    true,
  ],
  [
    "rename across workspaces",
    ["apps/admin/src/old.test.ts", "apps/web/src/new.ts"],
    "apps/admin apps/web",
    true,
    true,
  ],
  ["test configuration", ["apps/admin/vitest.config.mts"], "*", true, true],
  ["unknown workspace input", ["apps/admin/new-input.txt"], "*", true, true],
  [
    "unknown mixed with exempt test",
    ["unknown", "apps/admin/src/test.test.ts"],
    "*",
    true,
    true,
  ],
  ["empty comparison", [], "*", true, true],
];

for (const [name, files, directories, build, integration] of scenarios) {
  test(`CI scope for ${name}`, () => {
    assert.deepEqual(ciOutputs(selectCiChanges(files)), {
      scope: directories === "*" ? "full" : directories ? "affected" : "none",
      should_validate: Boolean(directories),
      should_validate_agents: Boolean(directories) || name === "agent resource",
      should_build: build,
      should_integrate: integration,
      turbo_filters:
        directories && directories !== "*"
          ? directories
              .split(" ")
              .map((directory) => `--filter=...{./${directory}}`)
              .join(" ")
          : directories === "*"
            ? "full"
            : "none",
    });
  });
}

test("CI distinguishes unavailable revision history from a selector failure", () => {
  const head = "a".repeat(40);
  const base = "b".repeat(40);
  const env = {
    HEAD_SHA: head,
    BASE_SHA: base,
    GITHUB_EVENT_NAME: "pull_request",
  };

  const git = (command, ...args) => {
    if (command === "diff") {
      throw new Error("diff failed");
    }

    return args[0] === "HEAD" ? head : base;
  };

  assert.equal(ciChanges(git, { ...env, BASE_SHA: "" }), null);
  assert.equal(
    ciChanges(
      (...args) => (args.includes(`${head}^1`) ? "" : git(...args)),
      env,
    ),
    null,
  );
  assert.throws(() => ciChanges(git, env), /diff failed/);
  assert.throws(
    () => ciChanges(git, { ...env, HEAD_SHA: base }),
    /does not match/,
  );
});

test("Quality Gates rejects missing scope, malformed outputs and non-successful required jobs", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  const gates = workflow.split("  quality-gates:")[1];
  assert.match(gates, /if: always\(\)/);

  for (const job of [
    "changes",
    "validate",
    "validate-agent-resources",
    "dependency-audit",
  ]) {
    assert.ok(gates.includes(`      - ${job}`));
  }

  const script = gates.split("        run: |")[1].replace(/^ {10}/gm, "");
  const shell =
    process.platform === "win32"
      ? execFileSync("git", ["var", "GIT_SHELL_PATH"], {
          encoding: "utf8",
        }).trim()
      : "bash";
  const valid = {
    CHANGES_RESULT: "success",
    AUDIT_RESULT: "success",
    AGENT_REQUIRED: "true",
    AGENT_RESULT: "success",
    VALIDATE_REQUIRED: "true",
    VALIDATE_RESULT: "success",
    SCOPE: "affected",
    BUILD_REQUIRED: "false",
    INTEGRATION_REQUIRED: "false",
    TURBO_FILTERS: "--filter=...{./apps/admin}",
  };
  const docs = {
    SCOPE: "none",
    VALIDATE_REQUIRED: "false",
    VALIDATE_RESULT: "skipped",
    AGENT_REQUIRED: "false",
    AGENT_RESULT: "skipped",
    TURBO_FILTERS: "none",
  };
  const cases = [
    [0, {}],
    [0, docs],
    [0, { ...docs, AGENT_REQUIRED: "true", AGENT_RESULT: "success" }],
    [
      0,
      {
        SCOPE: "full",
        TURBO_FILTERS: "full",
        BUILD_REQUIRED: "true",
        INTEGRATION_REQUIRED: "true",
      },
    ],
    [1, { ...docs, VALIDATE_RESULT: "success" }],
    [1, { ...docs, AGENT_RESULT: "cancelled" }],
    [1, { ...docs, BUILD_REQUIRED: "true" }],
    [1, { BUILD_REQUIRED: "" }],
    [1, { INTEGRATION_REQUIRED: "yes" }],
    [1, { SCOPE: "" }],
    [1, { VALIDATE_REQUIRED: "" }],
    [1, { AGENT_REQUIRED: "" }],
    [1, { TURBO_FILTERS: "" }],
    [1, { TURBO_FILTERS: "--filter=unknown" }],
    ...[
      "CHANGES_RESULT",
      "AUDIT_RESULT",
      "AGENT_RESULT",
      "VALIDATE_RESULT",
    ].flatMap((job) =>
      ["failure", "cancelled", "skipped", ""].map((result) => [
        1,
        { [job]: result },
      ]),
    ),
  ];

  for (const [status, overrides] of cases) {
    const env = { ...valid, ...overrides };
    const result = spawnSync(shell, ["-c", script], {
      env: { ...process.env, ...env },
      encoding: "utf8",
    });

    assert.ifError(result.error);
    assert.equal(result.status, status, JSON.stringify(env));
  }
});

test("workflow scopes live setup, keeps coverage and assigns a single owner for agent checks", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(workflow, /\n {4}services:/);
  assert.equal(
    workflow.match(/run: npm run agents:validate && npm run agents:test/g)
      ?.length,
    1,
  );
  assert.match(workflow, /tasks=\(typecheck test:coverage\)/);
  assert.match(
    workflow,
    /if \[\[ "\$BUILD_REQUIRED" == "true" \]\]; then\s+tasks\+=\(build\)/,
  );

  for (const name of [
    "Validate Prisma schema",
    "Prepare generated client for guarded rehearsals",
    "Install Playwright Chromium for authenticated integration tests",
    "Validate isolated backend transactions",
    "Validate isolated authentication lifecycle",
  ]) {
    assert.ok(
      workflow.includes(
        `- name: ${name}\n        if: needs.changes.outputs.should_integrate == 'true'`,
      ),
      name,
    );
  }
});

test("push and synthetic PR comparisons retain the whole endpoint change across merges", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "nextpress-ci-merge-"));

  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" });

  const commit = (file) => {
    writeFileSync(path.join(cwd, file), file);
    git("add", file);
    git("commit", "--quiet", "-m", file);

    return git("rev-parse", "HEAD").trim();
  };

  try {
    git("init", "--quiet", "--initial-branch=base");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.invalid");
    const ancestor = commit("origin.ts");
    git("switch", "--quiet", "-c", "topic");
    commit("first.ts");
    const topic = commit("second.ts");
    git("switch", "--quiet", "base");
    const base = commit("base-only.ts");

    assert.deepEqual(
      ciChanges(git, {
        BASE_SHA: topic,
        HEAD_SHA: base,
        GITHUB_EVENT_NAME: "push",
      }).sort(),
      ["base-only.ts", "first.ts", "second.ts"],
    );

    git("merge", "--quiet", "--no-ff", "topic", "-m", "synthetic PR merge");
    const head = git("rev-parse", "HEAD").trim();
    const env = {
      BASE_SHA: base,
      HEAD_SHA: head,
      GITHUB_EVENT_NAME: "pull_request",
    };

    assert.deepEqual(ciChanges(git, env).sort(), ["first.ts", "second.ts"]);
    assert.equal(ciChanges(git, { ...env, BASE_SHA: ancestor }), null);
    assert.deepEqual(
      ciChanges(git, {
        BASE_SHA: ancestor,
        HEAD_SHA: head,
        GITHUB_EVENT_NAME: "push",
      }).sort(),
      ["base-only.ts", "first.ts", "second.ts"],
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
