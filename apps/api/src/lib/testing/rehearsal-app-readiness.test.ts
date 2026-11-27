import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

import { waitForRehearsalApp } from "./rehearsal-app-readiness";

const readinessUrl = "http://127.0.0.1:1/live-preview";

it("reports a spawn failure instead of waiting for HTTP readiness", async () => {
  const child = spawn(process.execPath, [], {
    cwd: fileURLToPath(import.meta.url),
    stdio: "ignore",
  });

  await expect(waitForRehearsalApp(child, readinessUrl)).rejects.toThrow(
    `Could not start ${readinessUrl}`,
  );
});

it("reports the application exit code before readiness", async () => {
  const child = spawn(process.execPath, ["-e", "process.exit(7)"], {
    stdio: "ignore",
  });

  await expect(waitForRehearsalApp(child, readinessUrl)).rejects.toThrow(
    `Application for ${readinessUrl} exited before readiness (code 7)`,
  );
});
