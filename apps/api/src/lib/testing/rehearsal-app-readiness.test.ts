import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { expect, it } from "vitest";

import { waitForRehearsalApp } from "./rehearsal-app-readiness";

import type { ChildProcess } from "node:child_process";

const readinessUrl = "http://127.0.0.1:1/live-preview";

it("reports a spawn failure instead of waiting for HTTP readiness", async () => {
  const child = new EventEmitter() as ChildProcess;
  child.exitCode = null;
  child.signalCode = null;

  const readiness = waitForRehearsalApp(child, readinessUrl);
  child.emit(
    "error",
    Object.assign(new Error("spawn failed"), { code: "ENOENT" }),
  );

  await expect(readiness).rejects.toThrow(
    `Could not start ${readinessUrl}: ENOENT`,
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
