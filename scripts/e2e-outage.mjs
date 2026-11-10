import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";

const stalled = createServer(() => {});
await new Promise((resolve, reject) => {
  stalled.once("error", reject);
  stalled.listen(49303, "localhost", resolve);
});
try {
  for (const scenario of ["unavailable", "timeout"]) {
    for (const [app, port] of [
      ["web", 49200],
      ["admin", 49201],
    ]) {
      const child = spawn(
        process.execPath,
        [
          path.resolve("node_modules/next/dist/bin/next"),
          "dev",
          "--hostname",
          "localhost",
          "--port",
          String(port),
        ],
        {
          cwd: `apps/${app}`,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            NEXTPRESS_E2E: "1",
            API_INTERNAL_ORIGIN:
              scenario === "timeout"
                ? "http://localhost:49303"
                : "http://127.0.0.1:9",
            SITE_URL: "http://localhost:49200",
          },
          detached: process.platform !== "win32",
        },
      );
      let diagnostics = "";
      child.stdout.on("data", (chunk) => {
        diagnostics += chunk;
      });
      child.stderr.on("data", (chunk) => {
        diagnostics += chunk;
      });
      try {
        const startedAt = Date.now();
        let response;

        for (let attempt = 0; attempt < 60; attempt++) {
          if (child.exitCode !== null)
            throw new Error(`Isolated ${app} failed to start`);
          try {
            response = await fetch(
              `http://localhost:${port}${app === "admin" ? "/api/health" : "/"}`,
              { redirect: "manual", signal: AbortSignal.timeout(45_000) },
            );
            break;
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
        assert.ok(response, `Isolated ${app} never responded`);
        assert.equal(response.status, app === "admin" ? 502 : 500);
        if (app === "admin")
          assert.deepEqual(await response.json(), { error: "API unavailable" });
        else assert.match(diagnostics, /public\.upstream\.failed/);
        if (scenario === "timeout")
          assert.ok(Date.now() - startedAt >= (app === "admin" ? 29000 : 9000));
        console.log(
          `Independent ${app} startup and real HTTP API ${scenario} behavior passed (${response.status})`,
        );
      } finally {
        if (child.exitCode === null && child.pid) {
          if (process.platform === "win32")
            spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
              stdio: "ignore",
              timeout: 10_000,
            });
          else process.kill(-child.pid, "SIGKILL");
        }
      }
    }
  }
} finally {
  stalled.closeAllConnections();
  await new Promise((resolve) => stalled.close(resolve));
}
