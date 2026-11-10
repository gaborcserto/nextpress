import { ESLint } from "eslint";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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
import { format } from "oxfmt";

import { formatFiles } from "./quality-files.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
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
  for (const name of ["check-staged.mjs", "quality-files.mjs"])
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
  const run = (selected) =>
    spawnSync(
      process.execPath,
      [
        "scripts/check-staged.mjs",
        ...selected.map((file) => path.join(cwd, file)),
      ],
      { cwd, encoding: "utf8" },
    );
  const valid = run(files);
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
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
  }
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

test("lint-staged preserves partial unstaged edits and handles paths with spaces", (t) => {
  const cwd = fixture(t);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
  mkdirSync(path.join(cwd, "scripts"));
  for (const name of ["check-staged.mjs", "quality-files.mjs"])
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
    'export default [{files:["**/*.mjs"],rules:{"no-debugger":"error"}}];',
  );
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(cwd, "node_modules"),
    "junction",
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
    "export const x={value:2}\n\n\n// unrelated unstaged note\n",
  );
  writeFileSync(unrelated, "export const unrelated={untouched:2}\n");
  git("hook", "run", "pre-commit");
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
  assert.ok(staged.includes("value: 2"));
  // A lint failure must preserve both the staged version and unrelated worktree edits.
  writeFileSync(file, "debugger;\n\n// original\n");
  git("add", "file with spaces.mjs");
  writeFileSync(file, "debugger;\n\n// unrelated unstaged note\n");
  const beforeIndex = git("write-tree");
  const beforeWorktree = readFileSync(file, "utf8");
  const failure = spawnSync("git", ["hook", "run", "pre-commit"], {
    cwd,
    encoding: "utf8",
  });
  assert.notEqual(failure.status, 0);
  assert.equal(git("write-tree"), beforeIndex);
  assert.equal(readFileSync(file, "utf8"), beforeWorktree);
  assert.ok(git("show", ":file with spaces.mjs").includes("debugger;"));
  assert.ok(readFileSync(file, "utf8").includes("// unrelated unstaged note"));
});
