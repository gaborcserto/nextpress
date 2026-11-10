import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("packaging preserves internal relative package links and excludes environment files", (t) => {
  const fixture = mkdtempSync(path.join(tmpdir(), "nextpress-package-"));
  t.after(() => {
    assert.ok(
      realpathSync(fixture).startsWith(realpathSync(tmpdir()) + path.sep),
    );
    rmSync(fixture, { recursive: true, force: true });
  });
  const source = path.join(fixture, "apps/api/.next/standalone");
  const app = path.join(source, "apps/api");
  const dependency = path.join(source, "node_modules/example");
  mkdirSync(path.join(app, ".next/node_modules"), { recursive: true });
  mkdirSync(dependency, { recursive: true });
  writeFileSync(path.join(app, "server.js"), "server");
  writeFileSync(path.join(source, ".env"), "PRIVATE_CONFIG=fixture");
  writeFileSync(path.join(dependency, "index.js"), "dependency");
  const link = path.join(app, ".next/node_modules/example-hash");
  const relative = path.relative(path.dirname(link), dependency);
  symlinkSync(relative, link, "dir");
  const destination = path.join(fixture, "artifact");
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL("./package-app.mjs", import.meta.url)),
      "api",
      destination,
    ],
    { cwd: fixture },
  );
  const copied = path.join(
    destination,
    "apps/api/.next/node_modules/example-hash",
  );
  assert.equal(readlinkSync(copied), relative);
  assert.ok(realpathSync(copied).startsWith(destination + path.sep));
  assert.equal(
    readFileSync(path.join(copied, "index.js"), "utf8"),
    "dependency",
  );
  assert.equal(existsSync(path.join(destination, ".env")), false);
});
