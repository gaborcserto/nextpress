import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { inspectFiles } from "./readability.mjs";

const runner = fileURLToPath(new URL("./readability.mjs", import.meta.url));

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "nextpress-readability-"));
  t.after(() => {
    assert.ok(directory.startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(directory, { recursive: true, force: true });
  });

  return directory;
}

test("reports actual file counts, deduplicated violations and source locations", (t) => {
  const cwd = fixture(t);
  writeFileSync(
    path.join(cwd, "bad file.ts"),
    "const value = 1;\nconst callback = () => value;\n",
  );
  writeFileSync(path.join(cwd, "clean.ts"), "export const value = 1;\n");
  mkdirSync(path.join(cwd, "generated"));
  writeFileSync(path.join(cwd, "generated/client.ts"), "const = ;");
  const output = [];
  const result = inspectFiles(
    [
      "bad file.ts",
      "bad file.ts",
      "clean.ts",
      "missing.ts",
      "generated/client.ts",
    ],
    { cwd, verbose: true, log: (line) => output.push(line) },
  );
  assert.deepEqual(result, {
    inspected: 2,
    filesWithViolations: 1,
    violations: 1,
    errors: 0,
  });
  assert.match(output[0], /bad file.ts:2: readability\/spacing/);
  assert.match(
    output.at(-2),
    /Inspected 2 source files; 1 readability violations in 1 files; 0 parse errors/,
  );
  const failure = spawnSync(
    process.execPath,
    [runner, "--verbose", "--files", "bad file.ts"],
    { cwd, encoding: "utf8" },
  );
  assert.equal(failure.status, 1);
  assert.match(failure.stdout, /bad file.ts:2:/);
  const clean = spawnSync(process.execPath, [runner, "--files", "clean.ts"], {
    cwd,
    encoding: "utf8",
  });
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(
    clean.stdout,
    /Inspected 1 source files; 0 readability violations/,
  );
});

test("parse errors fail with diagnostics rather than a false clean result", (t) => {
  const cwd = fixture(t);
  writeFileSync(path.join(cwd, "invalid.ts"), "const = ;");
  const result = spawnSync(
    process.execPath,
    [runner, "--files", "invalid.ts"],
    { cwd, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /invalid.ts:1:7: readability\/parse/);
  assert.match(result.stdout, /1 parse errors/);
});

test("explicit empty selection fails and empty non-source selection reports zero honestly", (t) => {
  const cwd = fixture(t);
  assert.notEqual(
    spawnSync(process.execPath, [runner, "--files"], { cwd }).status,
    0,
  );
  const lines = [];
  assert.deepEqual(
    inspectFiles(["README.md"], { cwd, log: (line) => lines.push(line) }),
    { inspected: 0, filesWithViolations: 0, violations: 0, errors: 0 },
  );
  assert.match(lines[0], /Inspected 0 source files/);
});

test("parse diagnostics locate invalid syntax after leading lines", (t) => {
  const cwd = fixture(t);
  writeFileSync(path.join(cwd, "invalid.ts"), "// header\n\nconst = ;");
  const result = spawnSync(
    process.execPath,
    [runner, "--files", "invalid.ts"],
    { cwd, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /invalid.ts:3:7: readability\/parse/);
});

test("root lint and CI retain the readability gate and hooks expose actual reports", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.match(
    manifest.scripts["lint:readability"],
    /node --test.*readability.test.mjs.*&& node scripts\/readability.mjs/,
  );
  assert.match(
    manifest.scripts["lint:root"],
    /npm run lint:readability && eslint/,
  );
  assert.match(manifest.scripts.lint, /npm run lint:root && turbo run lint/);
  assert.match(
    readFileSync(
      new URL("../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    ),
    /run: npm run lint:root/,
  );
  assert.match(
    readFileSync(new URL("../.husky/pre-commit", import.meta.url), "utf8"),
    /lint-staged --verbose/,
  );
  const staged = readFileSync(
    new URL("./check-staged.mjs", import.meta.url),
    "utf8",
  );
  const hook = readFileSync(
    new URL("../.husky/pre-commit", import.meta.url),
    "utf8",
  );
  assert.match(hook, /node scripts\/test-readability.mjs && npx lint-staged/);
  assert.doesNotMatch(staged, /--test-reporter|spawnSync|readability.test.mjs/);
  assert.match(
    readFileSync(new URL("./test-readability.mjs", import.meta.url), "utf8"),
    /--test-reporter=spec/,
  );
  assert.ok(
    staged.indexOf("inspectFiles(files") < staged.indexOf("formatFiles(files"),
  );
});

test("default diagnostics are concise, verbose is detailed, and neither check writes", (t) => {
  const cwd = fixture(t);
  const source =
    "const value = 1;\nconst first = () => value;\nconst second = () => value;\n";
  const file = path.join(cwd, "many.ts");
  writeFileSync(file, source);
  const concise = spawnSync(process.execPath, [runner, "--files", "many.ts"], {
    cwd,
    encoding: "utf8",
  });
  assert.equal(concise.status, 1);
  assert.match(
    concise.stdout,
    /Inspected 1 source files; 2 readability violations in 1 files; 0 parse errors/,
  );
  assert.match(
    concise.stdout,
    /Autofix: node scripts\/readability.mjs --write/,
  );
  assert.doesNotMatch(concise.stdout, /many.ts:\d+:/);
  const detailed = spawnSync(
    process.execPath,
    [runner, "--verbose", "--files", "many.ts"],
    { cwd, encoding: "utf8" },
  );
  assert.equal(detailed.status, 1);
  assert.match(detailed.stdout, /many.ts:2: readability\/spacing/);
  assert.match(detailed.stdout, /many.ts:3: readability\/spacing/);
  assert.equal(readFileSync(file, "utf8"), source);
});
