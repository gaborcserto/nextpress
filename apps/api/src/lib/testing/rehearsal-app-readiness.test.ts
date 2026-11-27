import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

import { waitForRehearsalApp } from "./rehearsal-app-readiness";

import type { ChildProcess } from "node:child_process";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

const idleScript = "setInterval(() => {}, 1000)";
const children: ChildProcess[] = [];
const servers: Server[] = [];

function spawnNode(script: string) {
  const child = spawn(process.execPath, ["-e", script], { stdio: "ignore" });
  children.push(child);

  return child;
}

function listen(server: Server) {
  return new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}/live-preview`);
    });
  });
}

async function startServer(handler: Handler) {
  const server = createServer(handler);
  servers.push(server);

  return listen(server);
}

/** A URL on a port that was just free, so nothing answers there. */
async function unreachableUrl() {
  const server = createServer();
  const url = await listen(server);
  await new Promise<void>((resolve) => server.close(() => resolve()));

  return url;
}

function statusHandler(status: number): Handler {
  return (_request, response) => {
    response.statusCode = status;
    response.end();
  };
}

/** Replaces the 90 s startup deadline with a short one; other timeouts are untouched. */
function shortenDeadline(milliseconds = 100) {
  const timeout = AbortSignal.timeout.bind(AbortSignal);

  vi.spyOn(AbortSignal, "timeout").mockImplementation((duration) =>
    timeout(duration === 90_000 ? milliseconds : duration),
  );
}

afterEach(async () => {
  vi.restoreAllMocks();

  for (const child of children.splice(0)) {
    child.kill();
  }

  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
          server.closeAllConnections();
        }),
    ),
  );
});

describe("waitForRehearsalApp", () => {
  describe("readiness", () => {
    it("resolves once the endpoint answers with a 2xx status", async () => {
      const url = await startServer(statusHandler(200));
      const child = spawnNode(idleScript);

      await expect(waitForRehearsalApp(child, url)).resolves.toBeUndefined();
    });

    it("keeps polling through non-OK responses until the endpoint is ready", async () => {
      let requests = 0;
      const url = await startServer((_request, response) => {
        requests += 1;
        response.statusCode = requests === 1 ? 503 : 200;
        response.end();
      });

      const child = spawnNode(idleScript);

      await expect(waitForRehearsalApp(child, url)).resolves.toBeUndefined();
      expect(requests).toBe(2);
    });
  });

  describe("failure before readiness", () => {
    it("reports a spawn failure", async () => {
      const url = await unreachableUrl();

      const child = spawn("definitely-not-a-real-command-xyz", {
        stdio: "ignore",
      });

      await expect(waitForRehearsalApp(child, url)).rejects.toThrow(
        `Could not start ${url}: ENOENT`,
      );
    });

    it.each([0, 7])("reports exit code %i", async (code) => {
      const url = await unreachableUrl();
      const child = spawnNode(`process.exit(${code})`);

      await expect(waitForRehearsalApp(child, url)).rejects.toThrow(
        `Application for ${url} exited before readiness (code ${code})`,
      );
    });

    it("reports an application that had already exited before the call", async () => {
      const url = await unreachableUrl();
      const child = spawnNode("process.exit(3)");
      await once(child, "exit");

      await expect(waitForRehearsalApp(child, url)).rejects.toThrow(
        `Application for ${url} exited before readiness (code 3)`,
      );
    });

    it("reports an application that had already been terminated by a signal", async () => {
      const url = await unreachableUrl();
      const child = spawnNode(idleScript);
      child.kill("SIGTERM");
      await once(child, "exit");

      await expect(waitForRehearsalApp(child, url)).rejects.toThrow(
        `Application for ${url} exited before readiness (SIGTERM)`,
      );
    });

    it("stops polling when the application is killed mid-startup", async () => {
      const url = await startServer(statusHandler(503));
      const child = spawnNode(idleScript);

      const outcome = expect(waitForRehearsalApp(child, url)).rejects.toThrow(
        `Application for ${url} exited before readiness (SIGTERM)`,
      );
      child.kill("SIGTERM");

      await outcome;
    });
  });

  describe("startup deadline", () => {
    it("reports the last HTTP status when the endpoint never becomes ready", async () => {
      shortenDeadline();
      const url = await startServer(statusHandler(503));
      const child = spawnNode(idleScript);

      await expect(waitForRehearsalApp(child, url)).rejects.toThrow(
        `Readiness timed out for ${url} (last HTTP status: 503)`,
      );
    });

    it("reports that no HTTP response was ever received", async () => {
      shortenDeadline();
      const url = await unreachableUrl();
      const child = spawnNode(idleScript);

      await expect(waitForRehearsalApp(child, url)).rejects.toThrow(
        `Readiness timed out for ${url} (last HTTP status: none)`,
      );
    });
  });

  describe("listener cleanup", () => {
    it("removes its child listeners after becoming ready", async () => {
      const url = await startServer(statusHandler(200));
      const child = spawnNode(idleScript);
      const before = {
        error: child.listenerCount("error"),
        exit: child.listenerCount("exit"),
      };

      await waitForRehearsalApp(child, url);

      expect(child.listenerCount("error")).toBe(before.error);
      expect(child.listenerCount("exit")).toBe(before.exit);
    });

    it("removes its child listeners after failing", async () => {
      shortenDeadline();
      const url = await unreachableUrl();
      const child = spawnNode(idleScript);
      const before = {
        error: child.listenerCount("error"),
        exit: child.listenerCount("exit"),
      };

      await expect(waitForRehearsalApp(child, url)).rejects.toThrow();

      expect(child.listenerCount("error")).toBe(before.error);
      expect(child.listenerCount("exit")).toBe(before.exit);
    });
  });
});
