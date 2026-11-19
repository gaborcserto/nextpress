import assert from "node:assert/strict";
import { test } from "node:test";

import { waitForPostgres } from "./wait-for-postgres.mjs";

test("waits for the Compose server to accept TCP connections", async () => {
  const results = [
    { status: 1 },
    { status: 2 },
    { status: null, error: { code: "ETIMEDOUT" } },
    { status: 0 },
  ];
  const pauses = [];

  await waitForPostgres(
    "compose",
    (command, args) => {
      assert.equal(command, "docker");
      assert.deepEqual(args, [
        "compose",
        "exec",
        "-T",
        "db",
        "pg_isready",
        "-q",
        "-h",
        "127.0.0.1",
        "-p",
        "5432",
        "-d",
        "cms",
        "-t",
        "2",
      ]);

      return results.shift();
    },
    (milliseconds) => pauses.push(milliseconds),
  );

  assert.deepEqual(results, []);
  assert.deepEqual(pauses, [1_000, 1_000, 1_000]);
});

test("reports a missing editorial container without attempting to start it", async () => {
  const calls = [];

  await assert.rejects(
    waitForPostgres("editorial", (command, args) => {
      calls.push([command, ...args]);

      return { status: 1 };
    }),
    /Cannot find the editorial container/,
  );

  assert.deepEqual(calls, [
    ["docker", "container", "inspect", "nextpress-dev-editorial-db"],
  ]);
});

test("limits how long it retries an unavailable editorial server", async () => {
  let probes = 0;
  let pauses = 0;

  await assert.rejects(
    waitForPostgres(
      "editorial",
      (_command, args) => {
        if (args[0] === "container") {
          return { status: 0 };
        }

        assert.deepEqual(args, [
          "exec",
          "nextpress-dev-editorial-db",
          "pg_isready",
          "-q",
          "-h",
          "127.0.0.1",
          "-p",
          "5432",
          "-d",
          "nextpress_dev_editorial",
          "-t",
          "2",
        ]);
        probes++;

        return { status: 2 };
      },
      () => {
        pauses++;
      },
    ),
    /readiness timed out for editorial/,
  );

  assert.equal(probes, 15);
  assert.equal(pauses, 14);
});
