import { chromium, expect } from "@playwright/test";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  disposableDockerContext,
  verifyLocalDocker,
} from "../src/lib/testing/docker-database";

import type { Browser } from "@playwright/test";
import type { ChildProcess } from "node:child_process";

const dockerContext = disposableDockerContext().name;
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const runId = randomBytes(6).toString("hex");
const containerName = `nextpress-outage-${runId}`;
const volumeName = `nextpress-outage-data-${runId}`;
const databaseName = `nextpress_outage_${runId}`;
const databasePassword = randomBytes(24).toString("hex");
const runLabel = `nextpress.outage.run=${runId}`;
const image =
  "postgres@sha256:073e7c8b84e2197f94c8083634640ab37105effe1bc853ca4d5fbece3219b0e8";
const port = 55436;
const apiPort = 49452;
const adminPort = 49451;
const webPort = 49450;
const apiOrigin = `http://localhost:${apiPort}`;
const adminOrigin = `http://localhost:${adminPort}`;
const webOrigin = `http://localhost:${webPort}`;
const authenticationOrigin = "https://admin.nextpress.test";
const databaseUrl = `postgresql://postgres:${databasePassword}@127.0.0.1:${port}/${databaseName}`;
const processes: ChildProcess[] = [];
let browser: Browser | undefined;
let containerId: string | undefined;
let volumeCreated = false;

function docker(...args: string[]) {
  return execFileSync("docker", ["--context", dockerContext, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  }).trim();
}

function initializeSettings() {
  execFileSync(
    "docker",
    [
      "--context",
      dockerContext,
      "exec",
      "-i",
      containerName,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      databaseName,
    ],
    {
      encoding: "utf8",
      input:
        "INSERT INTO \"SiteSettings\" (id, \"siteName\", \"siteDescription\", \"updatedAt\") VALUES ('default', 'Outage Verification', 'Disposable outage checks', now()) ON CONFLICT (id) DO UPDATE SET \"siteName\" = EXCLUDED.\"siteName\", \"updatedAt\" = now(); INSERT INTO \"Role\" (id, name) VALUES ('outage-admin', 'ADMIN'), ('outage-editor', 'EDITOR'), ('outage-author', 'AUTHOR'), ('outage-subscriber', 'SUBSCRIBER') ON CONFLICT (name) DO NOTHING;",
      stdio: ["pipe", "ignore", "inherit"],
      timeout: 30_000,
    },
  );
}

function run(command: string, args: string[], env = process.env) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env,
    encoding: "utf8",
    stdio: "inherit",
    timeout: 120_000,
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
}

function inspectOwnedContainer() {
  if (!containerId) {
    throw new Error("The outage test has not created a database container");
  }

  const [container] = JSON.parse(docker("inspect", containerId)) as Array<{
    Id: string;
    Image: string;
    Config: { Labels: Record<string, string> };
    HostConfig: {
      Privileged: boolean;
      Binds: string[] | null;
      Mounts: Array<{ Type: string; Source: string; Target: string }>;
      PortBindings: Record<string, Array<{ HostIp: string; HostPort: string }>>;
    };
    Mounts: Array<{ Type: string; Name: string; Destination: string }>;
  }>;

  if (
    !container ||
    container.Id !== containerId ||
    container.Image !==
      docker("image", "inspect", image, "--format", "{{.Id}}") ||
    container.Config.Labels[runLabel.split("=")[0] ?? ""] !== runId ||
    container.Config.Labels["nextpress.outage.database"] !== databaseName ||
    container.HostConfig.Privileged ||
    (container.HostConfig.Binds?.length ?? 0) !== 0 ||
    container.HostConfig.Mounts.length !== 1 ||
    container.HostConfig.Mounts[0]?.Type !== "volume" ||
    container.HostConfig.Mounts[0]?.Source !== volumeName ||
    container.HostConfig.Mounts[0]?.Target !== "/var/lib/postgresql" ||
    container.Mounts.length !== 1 ||
    container.Mounts.some(
      (mount) =>
        mount.Type !== "volume" ||
        mount.Name !== volumeName ||
        mount.Destination !== "/var/lib/postgresql",
    ) ||
    container.HostConfig.PortBindings["5432/tcp"]?.[0]?.HostIp !==
      "127.0.0.1" ||
    container.HostConfig.PortBindings["5432/tcp"]?.[0]?.HostPort !==
      String(port)
  ) {
    throw new Error(
      "Refusing to control a database container without matching ownership evidence",
    );
  }

  return container;
}

function inspectOwnedVolume() {
  if (!volumeCreated) {
    throw new Error("The outage test has not created a database volume");
  }

  const [volume] = JSON.parse(docker("volume", "inspect", volumeName)) as {
    Name: string;
    Driver: string;
    Labels: Record<string, string>;
  }[];

  if (
    !volume ||
    volume.Name !== volumeName ||
    volume.Driver !== "local" ||
    volume.Labels[runLabel.split("=")[0] ?? ""] !== runId ||
    volume.Labels["nextpress.outage.database"] !== databaseName
  ) {
    throw new Error(
      "Refusing to control a database volume without matching ownership evidence",
    );
  }
}

async function waitForHttp(url: string, expectedStatus: number) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(2000),
      });

      if (response.status === expectedStatus) {
        return response;
      }
    } catch {
      // Wait for the owned process to begin accepting requests.
    }

    await delay(500);
  }

  throw new Error(`Service did not return HTTP ${expectedStatus}: ${url}`);
}

async function waitForResponse(url: string) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      return await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      await delay(500);
    }
  }

  throw new Error(`Service did not accept HTTP requests: ${url}`);
}

function startApplication(
  workspace: "api" | "admin" | "web",
  portNumber: number,
) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: databaseUrl,
    API_INTERNAL_ORIGIN: apiOrigin,
    BETTER_AUTH_URL: authenticationOrigin,
    NEXT_PUBLIC_BETTER_AUTH_URL: authenticationOrigin,
    NEXT_PUBLIC_ADMIN_URL: authenticationOrigin,
    NEXT_PUBLIC_PREVIEW_ORIGIN: webOrigin,
    PREVIEW_ADMIN_ORIGIN: adminOrigin,
    SITE_URL: webOrigin,
    BETTER_AUTH_SECRET: "outage-verification-secret-at-least-32-characters",
    HOSTNAME: "localhost",
    PORT: String(portNumber),
  };
  const child = spawn(process.execPath, ["server.js"], {
    cwd: resolve(
      repositoryRoot,
      `apps/${workspace}/.next/standalone/apps/${workspace}`,
    ),
    env,
    windowsHide: true,
    stdio: "inherit",
  });
  processes.push(child);

  child.once("error", (error) => {
    console.error(`Failed to start ${workspace}:`, error.message);
    process.exitCode = 1;
  });
}

function prepareStandaloneAssets(workspace: "api" | "admin" | "web") {
  const applicationRoot = resolve(repositoryRoot, `apps/${workspace}`);
  const staticAssets = resolve(applicationRoot, ".next/static");
  const standaloneStaticAssets = resolve(
    applicationRoot,
    `.next/standalone/apps/${workspace}/.next/static`,
  );

  if (!existsSync(staticAssets)) {
    throw new Error(`Production static assets are missing for ${workspace}`);
  }

  mkdirSync(standaloneStaticAssets, { recursive: true });
  cpSync(staticAssets, standaloneStaticAssets, { recursive: true });
}

async function stopApplications() {
  for (const child of processes.reverse()) {
    if (child.exitCode !== null || !child.pid) {
      continue;
    }

    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      child.kill("SIGTERM");
    }
  }
}

async function waitForDatabase() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      docker(
        "exec",
        containerName,
        "pg_isready",
        "-U",
        "postgres",
        "-d",
        databaseName,
      );

      return;
    } catch {
      await delay(500);
    }
  }

  throw new Error("Disposable PostgreSQL did not become ready");
}

async function verifyNormalOperation() {
  const health = await fetch(`${apiOrigin}/api/health`);
  expect(health.status).toBe(200);

  const settings = await fetch(`${apiOrigin}/api/public/settings`);
  expect(settings.status).toBe(200);
  expect(await settings.json()).toMatchObject({
    siteName: "Outage Verification",
  });

  const providers = await fetch(`${apiOrigin}/api/discovery/providers`);

  if (!providers.ok) {
    throw new Error(
      `Provider discovery failed: ${providers.status} ${await providers.text()}`,
    );
  }

  const session = await fetch(`${apiOrigin}/api/discovery/session`);

  if (!session.ok) {
    throw new Error(
      `Session discovery failed: ${session.status} ${await session.text()}`,
    );
  }

  const protectedUsers = await fetch(`${apiOrigin}/api/admin/users`);
  expect(protectedUsers.status).toBe(401);
  expect(await protectedUsers.json()).toMatchObject({ error: "Unauthorized" });

  const apiNavigation = await fetch(`${apiOrigin}/api/public/settings`, {
    headers: { accept: "text/html", "sec-fetch-mode": "navigate" },
  });
  expect(apiNavigation.status).toBe(200);
  expect(apiNavigation.headers.get("content-type")).toContain(
    "application/json",
  );

  expect(
    (await fetch(`${webOrigin}/en/posts`, { redirect: "manual" })).status,
  ).toBe(200);
  expect(
    (await fetch(`${adminOrigin}/auth/sign-in`, { redirect: "manual" })).status,
  ).toBe(200);
  console.log("PASS normal PostgreSQL, API JSON, Web and Admin");
}

async function verifyOutage() {
  inspectOwnedContainer();
  docker("stop", containerId ?? "");
  const stopped = inspectOwnedContainer();
  expect(
    JSON.parse(
      docker("inspect", "--format", "{{.State.Running}}", containerId ?? ""),
    ),
  ).toBe(false);
  expect(stopped.Id).toBe(containerId);

  const jsonResponse = await fetch(`${apiOrigin}/api/public/settings`);
  expect(jsonResponse.status).toBe(500);
  expect(jsonResponse.headers.get("x-nextpress-service-unavailable")).toBe("1");
  expect(await jsonResponse.json()).toEqual({ error: "Unexpected error" });

  const sessionResponse = await fetch(`${apiOrigin}/api/discovery/session`);
  expect(sessionResponse.status).toBe(500);
  expect(sessionResponse.headers.get("x-nextpress-service-unavailable")).toBe(
    "1",
  );
  expect(await sessionResponse.json()).toEqual({ error: "Unexpected error" });

  browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (error) =>
    console.error("Browser error:", error.message),
  );
  page.on("requestfailed", (request) =>
    console.error(
      "Browser request failed:",
      request.url(),
      request.failure()?.errorText,
    ),
  );
  const apiPage = await page.goto(`${apiOrigin}/api/public/settings`);
  expect(apiPage?.status()).toBe(503);
  await expect(
    page.getByRole("heading", { name: "503 Service unavailable" }),
  ).toBeVisible();

  const missingApiPage = await page.goto(
    `${apiOrigin}/api/missing-browser-test`,
  );
  expect(missingApiPage?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "404 Page not found" }),
  ).toBeVisible();

  const webPage = await page.goto(`${webOrigin}/en/posts`);
  expect(webPage?.status()).toBe(500);
  await expect(
    page.getByRole("heading", { name: "Service temporarily unavailable" }),
  ).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(
    databasePassword,
  );

  const adminPage = await page.goto(`${adminOrigin}/admin`);
  expect(adminPage?.status()).toBe(500);
  await expect(
    page.getByRole("heading", { name: "Service temporarily unavailable" }),
  ).toBeVisible();
  expect(page.url()).toContain("/admin");
  expect(await page.locator("body").innerText()).not.toContain(
    databasePassword,
  );
  console.log(
    "PASS real PostgreSQL outage, API JSON/HTML, Web and Admin fallbacks",
  );
}

async function verifyRecovery() {
  inspectOwnedContainer();
  docker("start", containerId ?? "");
  await waitForDatabase();
  inspectOwnedContainer();

  const settings = await fetch(`${apiOrigin}/api/public/settings`);
  expect(settings.status).toBe(200);

  await browser?.close();
  browser = await chromium.launch();
  const page = await browser.newPage();
  expect((await page.goto(`${webOrigin}/en/posts`))?.status()).toBe(200);
  expect((await page.goto(`${adminOrigin}/auth/sign-in`))?.status()).toBe(200);
  console.log("PASS PostgreSQL, API, Web and Admin recover after restart");
}

async function cleanup() {
  await browser?.close();
  await stopApplications();

  if (containerId) {
    inspectOwnedContainer();
    docker("rm", "--force", containerId);
  }

  if (volumeCreated) {
    inspectOwnedVolume();
    docker("volume", "rm", volumeName);
  }

  console.log("PASS disposable PostgreSQL container and volume cleanup");
}

async function main() {
  verifyLocalDocker();
  const existing = spawnSync(
    "docker",
    ["--context", dockerContext, "container", "inspect", containerName],
    { stdio: "ignore" },
  );

  if (existing.status === 0) {
    throw new Error("Generated disposable container name unexpectedly exists");
  }

  try {
    docker(
      "volume",
      "create",
      "--label",
      runLabel,
      "--label",
      `nextpress.outage.database=${databaseName}`,
      volumeName,
    );
    volumeCreated = true;
    inspectOwnedVolume();
    containerId = docker(
      "create",
      "--name",
      containerName,
      "--label",
      runLabel,
      "--label",
      `nextpress.outage.database=${databaseName}`,
      "--publish",
      `127.0.0.1:${port}:5432`,
      "--mount",
      `type=volume,src=${volumeName},dst=/var/lib/postgresql,volume-nocopy`,
      "--env",
      `POSTGRES_PASSWORD=${databasePassword}`,
      "--env",
      `POSTGRES_DB=${databaseName}`,
      image,
    );
    docker("start", containerId);
    inspectOwnedContainer();
    await waitForDatabase();
    const environment = { ...process.env, DATABASE_URL: databaseUrl };
    run(
      "npm",
      ["--workspace", "@nextpress/db", "run", "prisma:deploy"],
      environment,
    );
    initializeSettings();

    const appEnvironment = { ...process.env, DATABASE_URL: databaseUrl };

    run("npx", ["turbo", "run", "build", "--concurrency=2"], appEnvironment);

    prepareStandaloneAssets("api");
    prepareStandaloneAssets("admin");
    prepareStandaloneAssets("web");
    startApplication("api", apiPort);
    startApplication("admin", adminPort);
    startApplication("web", webPort);
    await waitForHttp(`${apiOrigin}/api/health`, 200);
    await waitForResponse(`${adminOrigin}/auth/sign-in`);
    await waitForHttp(`${webOrigin}/en/posts`, 200);
    await verifyNormalOperation();
    await verifyOutage();
    await verifyRecovery();
  } finally {
    await cleanup();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Outage verification failed",
  );
  process.exitCode = 1;
});
