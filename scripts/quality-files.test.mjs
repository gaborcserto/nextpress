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
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { format } from "oxfmt";

import { formatFiles } from "./quality-files.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
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
  assert.equal(
    path.resolve(git("rev-parse", "--show-toplevel").trim()),
    path.resolve(cwd),
  );
  const file = path.join(cwd, "file with spaces.mjs");
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
  const cli = path.join(
    path.dirname(require.resolve("lint-staged/package.json")),
    "bin/lint-staged.js",
  );
  execFileSync(process.execPath, [cli, "--concurrent", "false"], {
    cwd,
    stdio: "pipe",
  });
  assert.ok(readFileSync(file, "utf8").includes("// unrelated unstaged note"));
  const staged = git("show", ":file with spaces.mjs");
  assert.ok(staged.includes("// original"));
  assert.ok(!staged.includes("unrelated unstaged note"));
  assert.ok(staged.includes("value: 2"));
  // A lint failure must preserve both the staged version and unrelated worktree edits.
  writeFileSync(file, "debugger;\n\n// original\n");
  git("add", "file with spaces.mjs");
  writeFileSync(file, "debugger;\n\n// unrelated unstaged note\n");
  const failure = spawnSync(process.execPath, [cli, "--concurrent", "false"], {
    cwd,
    encoding: "utf8",
  });
  assert.notEqual(failure.status, 0);
  assert.ok(git("show", ":file with spaces.mjs").includes("debugger;"));
  assert.ok(readFileSync(file, "utf8").includes("// unrelated unstaged note"));
});
