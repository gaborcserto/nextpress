import { ESLint } from "eslint";
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { format } from "oxfmt";

import { formatFiles, reportFormatterOutput } from "./quality-files.mjs";
import { format as formatReadability } from "./readability-core.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function runGitHook({ cwd, env = process.env, timeoutMs = 120_000 }) {
  return new Promise((resolve, reject) => {
    const environment = { ...env };
    delete environment.NODE_TEST_CONTEXT;
    const child = spawn("git", ["hook", "run", "pre-commit"], {
      cwd,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    const timeout = setTimeout(() => {
      if (process.platform === "win32" && child.pid) {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
          timeout: 5000,
        });
      } else if (child.pid) process.kill(-child.pid, "SIGKILL");
      child.stdout.destroy();
      child.stderr.destroy();
      reject(
        new Error(
          `Git hook fixture timed out after ${timeoutMs}ms\n${stdout}\n${stderr}`,
        ),
      );
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (status) => {
      clearTimeout(timeout);
      resolve({ status, stdout, stderr });
    });
  });
}

const config = JSON.parse(
  readFileSync(new URL("../.oxfmtrc.json", import.meta.url), "utf8"),
);

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "nextpress-quality-"));
  t.after(() => {
    assert.ok(directory.startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(directory, { recursive: true, force: true });
  });
  writeFileSync(path.join(directory, ".oxfmtrc.json"), JSON.stringify(config));

  return directory;
}

test("hook fixture times out with captured diagnostics and terminates its process tree", async (t) => {
  const cwd = fixture(t);
  execFileSync("git", ["init", "--quiet"], { cwd });
  writeFileSync(
    path.join(cwd, ".git/hooks/pre-commit"),
    "#!/bin/sh\nnode -e 'console.log(\"waiting for fixture\");setInterval(()=>{},1000)'\n",
    { mode: 0o755 },
  );
  await assert.rejects(
    runGitHook({ cwd, timeoutMs: 3000 }),
    /timed out after 3000ms[\s\S]*waiting for fixture/,
  );
});

test("formatter rejects drift, writes only selected paths with spaces, ignores generated files and is stable", (t) => {
  const cwd = fixture(t);
  const source = "export const value={a:1}\n";

  for (const file of ["selected file.ts", "untouched.ts"])
    writeFileSync(path.join(cwd, file), source);
  mkdirSync(path.join(cwd, "generated"));
  writeFileSync(path.join(cwd, "generated/client.ts"), source);
  assert.throws(
    () => formatFiles(["selected file.ts"], { cwd }),
    /check failed/,
  );
  assert.equal(
    readFileSync(path.join(cwd, "selected file.ts"), "utf8"),
    source,
  );
  formatFiles(["selected file.ts", "generated/client.ts", "deleted.ts"], {
    cwd,
    write: true,
  });
  const once = readFileSync(path.join(cwd, "selected file.ts"), "utf8");
  formatFiles(["selected file.ts"], { cwd, write: true });
  formatFiles(["selected file.ts"], { cwd });
  assert.equal(readFileSync(path.join(cwd, "selected file.ts"), "utf8"), once);
  assert.equal(readFileSync(path.join(cwd, "untouched.ts"), "utf8"), source);
  assert.equal(
    readFileSync(path.join(cwd, "generated/client.ts"), "utf8"),
    source,
  );
  assert.deepEqual(formatFiles([], { cwd, write: true }), []);
});

test("staged runner uses owning configs across React, server, shared and root files", (t) => {
  const cwd = fixture(t);
  const workspaces = [
    ".",
    "apps/admin",
    "apps/web",
    "packages/shared",
    "packages/db",
  ];

  for (const workspace of workspaces) {
    mkdirSync(path.join(cwd, workspace), { recursive: true });
    copyFileSync(
      path.join(root, workspace, "eslint.config.mjs"),
      path.join(cwd, workspace, "eslint.config.mjs"),
    );
  }
  mkdirSync(path.join(cwd, "scripts"));
  for (const name of [
    "check-staged.mjs",
    "test-readability.mjs",
    "quality-files.mjs",
    "readability.mjs",
    "readability-core.mjs",
    "readability.test.mjs",
  ])
    copyFileSync(
      path.join(root, "scripts", name),
      path.join(cwd, "scripts", name),
    );
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(cwd, "node_modules"),
    "junction",
  );
  const files = [
    "apps/admin/src/components/example file.tsx",
    "apps/admin/src/lib/example.ts",
    "apps/web/src/components/example.tsx",
    "packages/shared/src/example.ts",
    "scripts/example.mjs",
    "packages/db/generated/client.ts",
  ];
  const generatedSource = "debugger; export const generated={value:1}\n";

  for (const file of files) {
    mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    let source = "export const example={value:1}\n";

    if (file.includes("generated/")) source = generatedSource;
    else if (file.endsWith(".tsx"))
      source = "export const example=<div>Example</div>\n";
    writeFileSync(path.join(cwd, file), source);
  }

  const run = (selected, verbose = false) =>
    spawnSync(
      process.execPath,
      [
        "scripts/check-staged.mjs",
        ...(verbose ? ["--verbose"] : []),
        ...selected.map((file) => path.join(cwd, file)),
      ],
      { cwd, encoding: "utf8" },
    );
  const valid = run(files);
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  const duplicate = run([files[0], files[0]]);
  assert.equal(duplicate.status, 0, duplicate.stdout + duplicate.stderr);
  assert.match(duplicate.stdout, /Inspected 1 source files/);
  assert.match(
    duplicate.stdout,
    /Staged checks: 1 files processed in \d+\.\d{2}s \(passed\)/,
  );
  assert.doesNotMatch(valid.stdout, /Finished in/);
  const detailed = run([files[0]], true);
  assert.equal(detailed.status, 0, detailed.stdout + detailed.stderr);
  assert.match(detailed.stdout, /Finished in/);
  assert.equal(
    readFileSync(path.join(cwd, files.at(-1)), "utf8"),
    generatedSource,
  );
  for (const file of files.slice(0, -1)) {
    assert.equal(
      readFileSync(path.join(cwd, file), "utf8"),
      file.endsWith(".tsx")
        ? "export const example = <div>Example</div>;\n"
        : "export const example = { value: 1 };\n",
    );
    writeFileSync(
      path.join(cwd, file),
      "debugger;\nexport const example = 1;\n",
    );
    const invalid = run([file]);
    assert.notEqual(invalid.status, 0, file);
    assert.match(invalid.stdout, /no-debugger/, file);
    assert.match(
      invalid.stdout,
      /Staged checks: 1 files processed in \d+\.\d{2}s \(failed\)/,
    );
  }
  writeFileSync(path.join(cwd, files[0]), "export const = ;");
  const formatterFailure = run([files[0]]);
  assert.notEqual(formatterFailure.status, 0);
  assert.match(
    formatterFailure.stdout,
    /Staged checks: 1 files processed in \d+\.\d{2}s \(failed\)/,
  );
  assert.match(
    formatterFailure.stdout + formatterFailure.stderr,
    /Formatting write failed/,
  );
});

test("formatter supports required languages and preserves directives, import order and JSX text", async () => {
  const samples = {
    "page.tsx":
      '"use client";\nimport Z from "z";\nimport A from "a";\nexport default function Page(){return <div><span>Hello world</span></div>}\n',
    "layout.tsx":
      'import "./z.css";\nimport "./a.css";\nexport default async function Layout(){return <html><body>Text</body></html>}\n',
    "route.ts":
      '"use server";\nexport async function action(){return {ok:true}}\n',
    "test.jsx": "export const X=()=> <div>hello</div>\n",
    "test.js": "export const x={a:1}\n",
    "test.mjs": "export const x={a:1}\n",
    "test.cjs": "module.exports={x:1}\n",
    "test.css": ".x{color:red;margin:0 1px}\n",
    "test.scss": "$color:red;.x{color:$color;&:hover{color:blue}}\n",
    "config.json": '{"b":1,"a":2}\n',
    "package.json": '{"version":"1.0.0","name":"example"}\n',
    "config.yml": "name: test\nitems: [one,two]\n",
  };

  for (const [file, source] of Object.entries(samples)) {
    const once = await format(file, source, config);
    assert.deepEqual(once.errors, [], file);
    const twice = await format(file, once.code, config);
    assert.equal(twice.code, once.code, file);
    assert.ok(!once.code.includes("\r"), file);
    if (source.startsWith('"use '))
      assert.ok(once.code.startsWith(source.split("\n")[0]));
    if (file === "page.tsx") {
      assert.ok(once.code.indexOf('from "z"') < once.code.indexOf('from "a"'));
      assert.ok(once.code.includes("Hello world"));
    }
    if (file === "layout.tsx")
      assert.ok(
        once.code.indexOf('"./z.css"') < once.code.indexOf('"./a.css"'),
      );
    if (file === "package.json")
      assert.ok(once.code.indexOf('"version"') < once.code.indexOf('"name"'));
  }
});

test("effective configs enforce quality, imports, hooks and preserve boundaries", async () => {
  for (const workspace of [
    "apps/admin",
    "apps/web",
    "packages/shared",
    "packages/db",
    ".",
  ]) {
    const eslint = new ESLint({ cwd: path.join(root, workspace) });
    const file = workspace === "." ? "scripts/fixture.cjs" : "src/fixture.ts";
    const effective = await eslint.calculateConfigForFile(file);
    assert.equal(effective.rules["no-debugger"][0], 2, workspace);
    const source =
      workspace === "."
        ? "missingGlobal();\nconst unused = 1;\n"
        : "export const value: any = 1;\nconst unused = 1;\n";
    const [result] = await eslint.lintText(source, { filePath: file });
    assert.ok(result.errorCount > 0, workspace);
    if (workspace !== ".") {
      assert.equal(effective.rules["import/order"][0], 2);
      assert.equal(effective.rules["import/no-duplicates"][0], 2);
      const [valid] = await eslint.lintText(
        "export function example(_unused: string) { return 1; }",
        { filePath: file },
      );
      assert.equal(valid.errorCount, 0, workspace);
    }
    if (workspace.startsWith("apps/"))
      assert.equal(effective.rules["react-hooks/exhaustive-deps"][0], 2);
    if (workspace === "apps/web" || workspace === "packages/shared")
      assert.equal(effective.rules["no-restricted-imports"][0], 2);
  }
});

test("admin UI modules cannot import their own umbrella but local and narrow public entries remain valid", async () => {
  const eslint = new ESLint({ cwd: path.join(root, "apps/admin") });

  for (const section of ["components", "primitives", "shell"]) {
    const filePath = `src/ui/${section}/Example/Example.ts`;

    for (const suffix of ["", "/", "/index", "/index.ts", "/index.js"]) {
      const [result] = await eslint.lintText(
        `export { Example } from "@/ui/${section}${suffix}";`,
        { filePath },
      );
      assert.ok(
        result.messages.some(
          (message) => message.ruleId === "no-restricted-imports",
        ),
        `${section}${suffix}`,
      );
    }
    for (const source of ["./Example.types", `@/ui/${section}/OtherModule`]) {
      const [result] = await eslint.lintText(
        `export { Example } from "${source}";`,
        { filePath },
      );
      assert.equal(result.errorCount, 0, `${filePath}: ${source}`);
    }
  }
  const [consumer] = await eslint.lintText(
    'export { EmailField } from "@/ui/components";',
    { filePath: "src/components/auth/Example.ts" },
  );
  assert.equal(
    consumer.errorCount,
    0,
    "existing external umbrella consumers remain supported",
  );
  const web = new ESLint({ cwd: path.join(root, "apps/web") });

  for (const source of ["./PostList", "@/components/public-ui/Container"]) {
    const [result] = await web.lintText(
      `export { Example } from "${source}";`,
      { filePath: "src/components/public-content/Example.ts" },
    );
    assert.equal(result.errorCount, 0, source);
  }
  const [boundary] = await web.lintText(
    'export { Example } from "admin/private";',
    { filePath: "src/components/public-content/Example.ts" },
  );
  assert.ok(
    boundary.messages.some(
      (message) => message.ruleId === "no-restricted-imports",
    ),
  );
});

test("invalid revisions and implicit full writes fail without touching files", () => {
  for (const args of [
    ["--format", "--full"],
    ["--format", "--base"],
    ["--format-check", "--base"],
    ["--format", "--base", "invalid-revision"],
    ["--format-check", "--ci"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/check-changed.mjs", ...args],
      {
        cwd: root,
        env: { ...process.env, BASE_SHA: "invalid-revision" },
        encoding: "utf8",
      },
    );
    assert.notEqual(result.status, 0, args.join(" "));
  }
});

test("CI selection runs on a clean checkout without installed dependencies", (t) => {
  const cwd = fixture(t);
  mkdirSync(path.join(cwd, "scripts"));
  for (const name of [
    "check-changed.mjs",
    "affected-workspaces.mjs",
    "quality-files.mjs",
  ])
    copyFileSync(
      path.join(root, "scripts", name),
      path.join(cwd, "scripts", name),
    );

  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
  git("init", "--quiet");
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
  const output = path.join(cwd, "output");
  const result = spawnSync(
    process.execPath,
    ["scripts/check-changed.mjs", "--ci"],
    {
      cwd,
      env: {
        ...process.env,
        BASE_SHA: "HEAD",
        HEAD_SHA: "HEAD",
        GITHUB_OUTPUT: output,
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(output, "utf8"),
    "should_validate=true\nturbo_filters=\n",
  );
  const base = git("rev-parse", "HEAD").trim();
  mkdirSync(path.join(cwd, "apps/web/src"), { recursive: true });
  writeFileSync(
    path.join(cwd, "apps/web/package.json"),
    '{\n  "name": "web"\n}\n',
  );
  const sourceFile = "apps/web/src/example.ts";
  const source = "export const example={value:1}\n";
  writeFileSync(path.join(cwd, sourceFile), source);
  git("add", "apps/web");
  git(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "web change",
  );

  const run = (...args) =>
    spawnSync(process.execPath, ["scripts/check-changed.mjs", ...args], {
      cwd,
      env: {
        ...process.env,
        BASE_SHA: base,
        HEAD_SHA: "HEAD",
        GITHUB_OUTPUT: output,
      },
      encoding: "utf8",
    });
  writeFileSync(output, "");
  assert.equal(run("--ci").status, 0);
  assert.equal(
    readFileSync(output, "utf8"),
    "should_validate=true\nturbo_filters=--filter=...{./apps/web}\n",
  );
  for (const args of [
    ["--format-check", "--ci"],
    ["--format-check", "--files", sourceFile],
    ["--format", "--files", sourceFile],
  ]) {
    const missing = run(...args);
    assert.notEqual(missing.status, 0);
    assert.match(
      missing.stderr,
      /Oxfmt is required for formatting\. Run npm ci/,
    );
    assert.equal(readFileSync(path.join(cwd, sourceFile), "utf8"), source);
  }
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(cwd, "node_modules"),
    "junction",
  );
  const drift = run("--format-check", "--ci");
  assert.notEqual(drift.status, 0);
  assert.match(drift.stderr, /Formatting check failed/);
  assert.equal(run("--format", "--files", sourceFile).status, 0);
  assert.equal(
    readFileSync(path.join(cwd, sourceFile), "utf8"),
    "export const example = { value: 1 };\n",
  );
  assert.equal(run("--format-check", "--ci").status, 0);
});

test("local and CI entry points reject committed format drift and base writes leave other files untouched", (t) => {
  const cwd = fixture(t);
  mkdirSync(path.join(cwd, "scripts"));
  for (const name of [
    "check-changed.mjs",
    "affected-workspaces.mjs",
    "quality-files.mjs",
  ]) {
    copyFileSync(
      path.join(root, "scripts", name),
      path.join(cwd, "scripts", name),
    );
  }
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(cwd, "node_modules"),
    "junction",
  );
  const copiedFormatter = path.join(cwd, "scripts/quality-files.mjs");
  writeFileSync(
    copiedFormatter,
    formatReadability(readFileSync(copiedFormatter, "utf8"), copiedFormatter),
  );
  writeFileSync(path.join(cwd, ".gitignore"), "node_modules/\n");

  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
  git("init", "--quiet");
  assert.equal(
    path.resolve(git("rev-parse", "--show-toplevel").trim()),
    path.resolve(cwd),
  );
  writeFileSync(
    path.join(cwd, "untouched.ts"),
    "export const untouched={x:1}\n",
  );
  git("add", ".");
  git(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "initial",
  );
  const base = git("rev-parse", "HEAD").trim();
  writeFileSync(path.join(cwd, "new file.ts"), "export const changed={x:1}\n");
  git("add", "new file.ts");
  git(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "drift",
  );

  const run = (...args) =>
    spawnSync(process.execPath, ["scripts/check-changed.mjs", ...args], {
      cwd,
      env: { ...process.env, BASE_SHA: base, HEAD_SHA: "HEAD" },
      encoding: "utf8",
    });
  assert.notEqual(run("--format-check", "--base", base).status, 0);
  assert.notEqual(run("--format-check", "--ci").status, 0);
  assert.equal(run("--format", "--base", base).status, 0);
  assert.equal(run("--format-check", "--ci").status, 0);
  assert.equal(
    readFileSync(path.join(cwd, "untouched.ts"), "utf8"),
    "export const untouched={x:1}\n",
  );
});

test("lint-staged preserves partial unstaged edits and handles paths with spaces", async (t) => {
  const cwd = fixture(t);

  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
  mkdirSync(path.join(cwd, "scripts"));
  for (const name of [
    "check-staged.mjs",
    "test-readability.mjs",
    "quality-files.mjs",
    "readability.mjs",
    "readability-core.mjs",
    "readability.test.mjs",
  ])
    copyFileSync(
      path.join(root, "scripts", name),
      path.join(cwd, "scripts", name),
    );
  copyFileSync(
    path.join(root, "lint-staged.config.mjs"),
    path.join(cwd, "lint-staged.config.mjs"),
  );
  writeFileSync(path.join(cwd, "package.json"), '{"type":"module"}');
  writeFileSync(
    path.join(cwd, "eslint.config.mjs"),
    'import config from "@nextpress/eslint-config/base"; export default config;',
  );
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(cwd, "node_modules"),
    "junction",
  );
  const copiedFormatter = path.join(cwd, "scripts/quality-files.mjs");
  writeFileSync(
    copiedFormatter,
    formatReadability(readFileSync(copiedFormatter, "utf8"), copiedFormatter),
  );
  writeFileSync(path.join(cwd, ".gitignore"), "node_modules/\n");
  git("init", "--quiet");
  mkdirSync(path.join(cwd, ".husky"));
  copyFileSync(
    path.join(root, ".husky/pre-commit"),
    path.join(cwd, ".husky/pre-commit"),
  );
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'import husky from "husky"; const error = husky(); if (error) throw new Error(error);',
    ],
    { cwd },
  );
  assert.equal(
    path.resolve(git("rev-parse", "--show-toplevel").trim()),
    path.resolve(cwd),
  );
  const file = path.join(cwd, "file with spaces.mjs");
  const unrelated = path.join(cwd, "unrelated.mjs");
  mkdirSync(path.join(cwd, "packages/db/generated"), { recursive: true });
  copyFileSync(
    path.join(root, "packages/db/eslint.config.mjs"),
    path.join(cwd, "packages/db/eslint.config.mjs"),
  );
  const generated = path.join(cwd, "packages/db/generated/client.ts");
  const generatedSource = "debugger; export const generated={value:1}\n";
  writeFileSync(generated, generatedSource);
  writeFileSync(unrelated, "export const unrelated = 1;\n");
  writeFileSync(file, "export const x = 1;\n\n\n// original\n");
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
  writeFileSync(file, "export const x={value:2}\n\n\n// original\n");
  git("add", "file with spaces.mjs");
  writeFileSync(
    file,
    "export const x={value:2}\n\n\n// unrelated unstaged note\ndebugger;\n",
  );
  writeFileSync(unrelated, "export const unrelated={untouched:2}\n");
  const plainEnvironment = { ...process.env, NO_COLOR: "1" };
  delete plainEnvironment.FORCE_COLOR;
  const success = await runGitHook({
    cwd,
    encoding: "utf8",
    env: plainEnvironment,
  });
  const successOutput = success.stdout + success.stderr;
  assert.equal(success.status, 0, successOutput);
  assert.ok(!successOutput.includes("\u001b["));
  const plainOutput = stripVTControlCharacters(successOutput);
  assert.match(plainOutput, /tests 8/);
  assert.match(plainOutput, /pass 8/);
  assert.match(plainOutput, /fail 0/);
  assert.equal(
    (
      plainOutput.match(
        /^\u2714 (?:separates|preserves|keeps|rejects) .+ \(.+\)$/gm,
      ) ?? []
    ).length,
    8,
  );
  assert.match(
    plainOutput,
    /\u2714 separates function values, named functions, methods, control flow and returns/,
  );
  assert.match(
    plainOutput,
    /\u2714 keeps value hooks and unidentifiable factory calls grouped/,
  );
  assert.match(
    successOutput,
    /Inspected 1 source files; 0 readability violations/,
  );
  assert.match(successOutput, /Check staged files/);
  assert.doesNotMatch(successOutput, /Finished in/);
  assert.match(
    plainOutput,
    /Staged checks: 1 files processed in \d+\.\d{2}s \(passed\)/,
  );
  assert.equal(readFileSync(generated, "utf8"), generatedSource);
  assert.equal(
    git("diff", "--cached", "--name-only").trim(),
    "file with spaces.mjs",
  );
  assert.equal(
    readFileSync(unrelated, "utf8"),
    "export const unrelated={untouched:2}\n",
  );
  assert.ok(readFileSync(file, "utf8").includes("// unrelated unstaged note"));
  const staged = git("show", ":file with spaces.mjs");
  assert.ok(staged.includes("// original"));
  assert.ok(!staged.includes("unrelated unstaged note"));
  assert.ok(!staged.includes("debugger"));
  assert.match(readFileSync(file, "utf8"), /debugger;/);
  assert.ok(staged.includes("value: 2"));
  // A lint failure must preserve both the staged version and unrelated worktree edits.
  writeFileSync(file, "debugger;\n\n// original\n");
  git("add", "file with spaces.mjs");
  writeFileSync(file, "debugger;\n\n// unrelated unstaged note\n");
  const beforeIndex = git("write-tree");
  const beforeWorktree = readFileSync(file, "utf8");
  const failure = await runGitHook({
    cwd,
    encoding: "utf8",
  });
  assert.notEqual(failure.status, 0);
  assert.equal(git("write-tree"), beforeIndex);
  assert.equal(readFileSync(file, "utf8"), beforeWorktree);
  assert.ok(git("show", ":file with spaces.mjs").includes("debugger;"));
  assert.ok(readFileSync(file, "utf8").includes("// unrelated unstaged note"));
  writeFileSync(file, "export const colored = 1;\n");
  git("add", "file with spaces.mjs");
  const colorEnvironment = { ...process.env, FORCE_COLOR: "1" };
  delete colorEnvironment.NO_COLOR;
  delete colorEnvironment.NODE_DISABLE_COLORS;
  const colored = await runGitHook({
    cwd,
    encoding: "utf8",
    env: colorEnvironment,
  });
  const colorOutput = colored.stdout + colored.stderr;
  assert.equal(colored.status, 0, stripVTControlCharacters(colorOutput));
  assert.ok(colorOutput.includes("\u001b[32m\u2714 separates function values"));
  assert.ok(colorOutput.includes("\u001b[34m\u2139 tests 8"));
  assert.ok(colorOutput.includes("\u001b[34m\u2139 pass 8"));
  const violation = "export function first() {}\nexport function second() {}\n";
  writeFileSync(file, violation + "\n// original\n");
  git("add", "file with spaces.mjs");
  writeFileSync(file, violation + "\n// unrelated unstaged note\n");
  const readabilityIndex = git("write-tree");
  const readabilityWorktree = readFileSync(file, "utf8");
  const readabilityFailure = await runGitHook({
    cwd,
    encoding: "utf8",
  });
  assert.notEqual(readabilityFailure.status, 0);
  assert.match(
    readabilityFailure.stdout + readabilityFailure.stderr,
    /1 readability violations in 1 files/,
  );
  assert.equal(git("write-tree"), readabilityIndex);
  assert.equal(readFileSync(file, "utf8"), readabilityWorktree);
  assert.match(
    stripVTControlCharacters(
      readabilityFailure.stdout + readabilityFailure.stderr,
    ),
    /pass 8/,
  );
  assert.doesNotMatch(
    readabilityFailure.stdout + readabilityFailure.stderr,
    /readability\/spacing/,
  );
  writeFileSync(file, "export const clean = 1;\n");
  git("add", "file with spaces.mjs");
  const testFile = path.join(cwd, "scripts/readability.test.mjs");
  writeFileSync(
    testFile,
    readFileSync(testFile, "utf8") +
      '\ntest("fixture-only test failure", () => assert.fail("expected fixture failure"));\n',
  );
  const testFailure = await runGitHook({
    cwd,
    encoding: "utf8",
    env: colorEnvironment,
  });
  assert.notEqual(testFailure.status, 0);
  const failureOutput = stripVTControlCharacters(
    testFailure.stdout + testFailure.stderr,
  );
  assert.match(failureOutput, /fixture-only test failure/);
  assert.match(failureOutput, /fail 1/);
  assert.doesNotMatch(failureOutput, /Oxfmt formatting/);
  // Keep a low argument limit to prove native tasks receive the complete file list.
  writeFileSync(
    testFile,
    readFileSync(path.join(root, "scripts/readability.test.mjs"), "utf8"),
  );
  const hookFile = path.join(cwd, ".husky/pre-commit");
  writeFileSync(
    hookFile,
    readFileSync(hookFile, "utf8").replace(
      "lint-staged --verbose",
      "lint-staged --verbose --max-arg-length 4000 --concurrent false",
    ),
  );
  const largeFiles = Array.from(
    { length: 80 },
    (_, index) =>
      `large file ${String(index).padStart(3, "0")}-${"x".repeat(64)}.mjs`,
  );

  for (const [index, name] of largeFiles.entries()) {
    writeFileSync(
      path.join(cwd, name),
      `export const value={index:${index}}\n`,
    );
  }
  writeFileSync(path.join(cwd, "large style.css"), ".example{color:red}\n");
  writeFileSync(path.join(cwd, "large config.json"), '{"example":true}');
  git("add", "--", ...largeFiles, "large style.css", "large config.json");
  writeFileSync(
    file,
    "export const clean = 1;\n// preserved unstaged comment\n",
  );
  const batched = await runGitHook({
    cwd,
    encoding: "utf8",
    env: plainEnvironment,
  });
  const batchedOutput = stripVTControlCharacters(
    batched.stdout + batched.stderr,
  );
  assert.equal(batched.status, 0, batchedOutput);
  assert.equal(
    (batchedOutput.match(/tests 8/g) ?? []).length,
    1,
    batchedOutput,
  );
  const inspectedBatches = [
    ...batchedOutput.matchAll(
      /Inspected (\d+) source files; 0 readability violations/g,
    ),
  ];
  assert.equal(inspectedBatches.length, 1, batchedOutput);
  assert.equal((batchedOutput.match(/\[check:staged\]/g) ?? []).length, 1);
  assert.equal((batchedOutput.match(/Staged checks:/g) ?? []).length, 1);
  assert.match(
    batchedOutput,
    /Staged checks: 83 files processed in \d+\.\d{2}s \(passed\)/,
  );
  assert.doesNotMatch(batchedOutput, /Finished in/);
  assert.equal(
    inspectedBatches.reduce((sum, match) => sum + Number(match[1]), 0),
    81,
  );

  for (const [index, name] of largeFiles.entries()) {
    assert.equal(
      git("show", `:${name}`),
      `export const value = { index: ${index} };\n`,
    );
  }
  assert.match(readFileSync(file, "utf8"), /preserved unstaged comment/);
  assert.doesNotMatch(
    git("show", ":file with spaces.mjs"),
    /preserved unstaged comment/,
  );
  const defaultHook = readFileSync(hookFile, "utf8");
  writeFileSync(hookFile, defaultHook.trimEnd() + " --debug\n");
  const detailedHook = await runGitHook({
    cwd,
    encoding: "utf8",
    env: plainEnvironment,
  });
  const detailedOutput = stripVTControlCharacters(
    detailedHook.stdout + detailedHook.stderr,
  );
  assert.equal(detailedHook.status, 0, detailedOutput);
  assert.ok(
    (detailedOutput.match(/Finished in/g) ?? []).length > 1,
    detailedOutput,
  );
  assert.equal(
    (detailedOutput.match(/Inspected \d+ source files/g) ?? []).length,
    1,
  );
  assert.equal((detailedOutput.match(/Staged checks:/g) ?? []).length, 1);
  writeFileSync(hookFile, defaultHook);
  const lastFile = largeFiles.at(-1);
  const lastPath = path.join(cwd, lastFile);
  const invalidSource =
    "export const value = 1;\nexport const callback = () => value;\n";
  writeFileSync(lastPath, invalidSource);
  git("add", "--", lastFile);
  writeFileSync(lastPath, invalidSource + "// preserved unstaged tail\n");
  const batchIndex = git("write-tree");
  const batchWorktree = readFileSync(lastPath, "utf8");
  const rejectedBatch = await runGitHook({
    cwd,
    encoding: "utf8",
    env: plainEnvironment,
  });
  const rejectedOutput = stripVTControlCharacters(
    rejectedBatch.stdout + rejectedBatch.stderr,
  );
  assert.notEqual(rejectedBatch.status, 0);
  assert.equal(
    (rejectedOutput.match(/tests 8/g) ?? []).length,
    1,
    rejectedOutput,
  );
  assert.match(rejectedOutput, /1 readability violations in 1 files/);
  assert.match(
    rejectedOutput,
    /Staged checks: 83 files processed in \d+\.\d{2}s \(failed\)/,
  );
  assert.equal(
    (rejectedOutput.match(/Inspected \d+ source files/g) ?? []).length,
    1,
    rejectedOutput,
  );
  assert.match(
    rejectedOutput,
    /Inspected 81 source files; 1 readability violations in 1 files/,
  );
  assert.equal(git("write-tree"), batchIndex);
  assert.equal(readFileSync(lastPath, "utf8"), batchWorktree);
  assert.match(readFileSync(file, "utf8"), /preserved unstaged comment/);
});

test("type import grouping and readability boundaries agree without disabling either rule", async () => {
  const eslint = new ESLint({ cwd: path.join(root, "apps/web") });
  const source =
    'import styles from "./styles.module.css";\n\nimport type { ReactNode } from "react";\n\nexport const example = styles;\nexport type Child = ReactNode;\n';
  const [clean] = await eslint.lintText(source, {
    filePath: "src/components/ReadabilityImportFixture.ts",
  });
  assert.equal(clean.errorCount, 0, JSON.stringify(clean.messages));
  assert.equal(formatReadability(source, "fixture.ts"), source);
  const [invalid] = await eslint.lintText(
    source.replace(";\n\nimport type", ";\nimport type"),
    { filePath: "src/components/ReadabilityImportFixture.ts" },
  );
  assert.ok(
    invalid.messages.some((message) => message.ruleId === "import/order"),
  );
});

test("staged formatter output hides only successful timing lines and retains diagnostics", (t) => {
  const progress = "Finished in 3ms on 20 files using 16 threads.";
  const messages = [];
  reportFormatterOutput(
    {
      stdout:
        "\u001b[32m" + progress + "\u001b[39m\nWarning: example warning\n",
      stderr: "stderr warning\n",
      status: 0,
    },
    { log: (message) => messages.push(message) },
  );
  assert.doesNotMatch(messages.join("\n"), /Finished in/);
  assert.match(messages.join("\n"), /Warning: example warning/);
  assert.match(messages.join("\n"), /stderr warning/);
  const detailed = [];
  reportFormatterOutput(
    { stdout: progress, stderr: "", status: 0 },
    { verbose: true, log: (message) => detailed.push(message) },
  );
  assert.equal(detailed[0], progress);
  const failure = [];
  reportFormatterOutput(
    { stdout: progress, stderr: "error details", status: 1 },
    { log: (message) => failure.push(message) },
  );
  assert.equal(failure[0], progress);
  assert.equal(failure[1], "error details");
  const cwd = fixture(t);
  writeFileSync(path.join(cwd, "bad.ts"), "export const = ;");
  const errors = [];
  assert.throws(
    () =>
      formatFiles(["bad.ts"], {
        cwd,
        write: true,
        log: (message) => errors.push(message),
      }),
    /write failed/,
  );
  assert.match(errors.join("\n"), /bad.ts/);
});
