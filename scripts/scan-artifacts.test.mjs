import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("artifact scanning fails closed and never prints a matched secret", (t) => {
  const folder = mkdtempSync(path.join(tmpdir(), "nextpress-artifact-"));
  t.after(() => {
    assert.ok(
      realpathSync(folder).startsWith(realpathSync(tmpdir()) + path.sep),
    );
    rmSync(folder, { force: true, recursive: true });
  });
  const secret = "fixture-artifact-secret-20261110";

  const run = () =>
    spawnSync(process.execPath, ["scripts/scan-artifacts.mjs", folder], {
      encoding: "utf8",
      env: { ...process.env, BETTER_AUTH_SECRET: secret },
    });
  writeFileSync(path.join(folder, "server.js"), "console.log('public');");
  assert.equal(run().status, 0);
  writeFileSync(
    path.join(folder, "server.js"),
    JSON.stringify({ value: secret }),
  );
  const result = run();
  assert.equal(result.status, 1);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(secret));
  writeFileSync(path.join(folder, "server.js"), "public");
  writeFileSync(
    path.join(folder, "server.js"),
    'const header = "-----BEGIN PRIVATE KEY-----";',
  );
  assert.equal(run().status, 0);
  const key = `-----BEGIN PRIVATE KEY-----\n${"A".repeat(64)}\n-----END PRIVATE KEY-----`;
  writeFileSync(path.join(folder, "server.js"), key);
  assert.equal(run().status, 1);
  writeFileSync(path.join(folder, "server.js"), JSON.stringify(key));
  assert.equal(run().status, 1);
  writeFileSync(path.join(folder, "server.js"), "public");
  writeFileSync(path.join(folder, ".env.production"), "public");
  assert.equal(run().status, 1);
});
