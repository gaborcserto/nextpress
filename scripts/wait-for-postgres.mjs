import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const editorialContainer = "nextpress-dev-editorial-db";
const attempts = 15;

export async function waitForPostgres(target, run = spawnSync, pause = delay) {
  if (target !== "compose" && target !== "editorial") {
    throw new Error("Usage: npm run db:ready -- <compose|editorial>");
  }

  const options = { stdio: "ignore", timeout: 4_000 };
  const editorial = target === "editorial";
  const container = editorial
    ? ["exec", editorialContainer]
    : ["compose", "exec", "-T", "db"];
  const database = editorial ? "nextpress_dev_editorial" : "cms";
  const recovery = editorial
    ? `Check Docker and the existing ${editorialContainer} container. See README.md for recovery.`
    : "Check Docker and the Compose db service with docker compose ps db.";
  const probe = [
    ...container,
    "pg_isready",
    "-q",
    "-h",
    "127.0.0.1",
    "-p",
    "5432",
    "-d",
    database,
    "-t",
    "2",
  ];

  if (
    editorial &&
    run("docker", ["container", "inspect", editorialContainer], options)
      .status !== 0
  ) {
    throw new Error(`Cannot find the editorial container. ${recovery}`);
  }

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { status, error } = run("docker", probe, options);

    if (status === 0) {
      return;
    }

    if (status !== 1 && status !== 2 && error?.code !== "ETIMEDOUT") {
      throw new Error(`PostgreSQL readiness probe failed. ${recovery}`);
    }

    if (attempt < attempts) {
      await pause(1_000);
    }
  }

  throw new Error(`PostgreSQL readiness timed out for ${target}. ${recovery}`);
}

if (import.meta.main) {
  const [target] = process.argv.slice(2);

  try {
    await waitForPostgres(target);
    console.log(
      `PostgreSQL is accepting connections in the ${target} container.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
