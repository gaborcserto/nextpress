import { setTimeout } from "node:timers/promises";

import type { ChildProcess } from "node:child_process";

export async function waitForRehearsalApp(child: ChildProcess, url: string) {
  const stopped = new AbortController();
  const deadline = AbortSignal.timeout(90_000);
  const startup = AbortSignal.any([stopped.signal, deadline]);
  let lastStatus: number | undefined;

  function onSpawnError(error: NodeJS.ErrnoException) {
    stopped.abort(
      new Error(`Could not start ${url}: ${error.code ?? error.name}`),
    );
  }

  function onExit(code: number | null, signal: NodeJS.Signals | null) {
    stopped.abort(
      new Error(
        `Application for ${url} exited before readiness (${signal ?? `code ${code}`})`,
      ),
    );
  }

  child.on("error", onSpawnError);
  child.once("exit", onExit);

  try {
    if (child.exitCode !== null || child.signalCode !== null) {
      onExit(child.exitCode, child.signalCode);
    }

    while (!startup.aborted) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.any([startup, AbortSignal.timeout(5_000)]),
        });
        lastStatus = response.status;
        await response.body?.cancel();

        if (response.ok && !startup.aborted) {
          return;
        }
      } catch {
        // The dev server may still be listening or compiling its first route.
      }

      // Exit and deadline both interrupt polling, including the sleep between probes.
      await setTimeout(250, undefined, { signal: startup }).catch(() => {});
    }

    stopped.signal.throwIfAborted();
    throw new Error(
      `Readiness timed out for ${url} (last HTTP status: ${lastStatus ?? "none"})`,
    );
  } finally {
    child.off("error", onSpawnError);
    child.off("exit", onExit);
  }
}
