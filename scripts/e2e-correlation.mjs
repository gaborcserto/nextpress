import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import path from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";

// Run from the repository root after building API, Admin and Web with NEXTPRESS_E2E=1.
const host = "127.0.0.1";
const signingVariable = "NEXTPRESS_REQUEST_CORRELATION_SECRET";
const signingKey = "qual01b-synthetic-correlation-fixture-key";
const wrongKey = `${signingKey}-mismatch`;
const authKey = "qual01b-synthetic-auth-fixture-secret";
const databaseName = "qual01b_fixture";
const requestIdHeader = "x-request-id";
const signatureHeader = "x-nextpress-request-signature";
const renderIdHeader = "x-nextpress-render-id";
const browserId = randomUUID();
const browserHeaders = {
  [requestIdHeader]: browserId,
  [renderIdHeader]: browserId,
  [signatureHeader]: "browser-signature-fixture",
};
const redirectLocation = "https://provider.example.invalid/authorize";
const cookies = [
  "session=; Max-Age=0; Path=/; HttpOnly",
  "oauth=fixture; Path=/; HttpOnly; SameSite=Lax",
];
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const paths = {
  health: "/api/health",
  settings: "/api/public/settings",
  media: "/api/public/media/correlation-fixture",
  redirect: "/api/auth/callback/github",
};
const children = new Set();
const listeners = new Set();

async function listen(server) {
  server.listen(0, host);
  await once(server, "listening", { signal: AbortSignal.timeout(5_000) });
  listeners.add(server);

  return server.address().port;
}

async function close(server) {
  const closed = once(server, "close", { signal: AbortSignal.timeout(5_000) });
  server.close();
  server.closeAllConnections?.();
  await closed;
  listeners.delete(server);
}

async function eventually(ready, message) {
  const until = Date.now() + 15_000;

  while (Date.now() < until) {
    const result = await ready();

    if (result) {
      return result;
    }

    await delay(100);
  }

  throw new Error(message);
}

function standalonePath(app) {
  return path.resolve(`apps/${app}/.next-e2e/standalone/apps/${app}/server.js`);
}

async function start(app, environment) {
  const entry = standalonePath(app);
  const reservation = createTcpServer();
  const port = await listen(reservation);
  await close(reservation);
  const origin = `http://${host}:${port}`;
  const child = spawn(process.execPath, [entry], {
    cwd: path.dirname(entry),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...environment,
      HOSTNAME: host,
      PORT: String(port),
      NODE_ENV: "production",
    },
  });
  children.add(child);
  const records = [];
  let started = false;
  let leaked = false;
  let spawnFailed = false;
  child.on("error", () => {
    spawnFailed = true;
  });

  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on("line", (line) => {
      if (line.includes("Ready in")) {
        started = true;
      }

      if (
        [
          signingKey,
          authKey,
          databaseName,
          browserHeaders[signatureHeader],
        ].some((value) => line.includes(value))
      ) {
        leaked = true;
      }

      if (line.startsWith("{") && records.length < 100 && line.length < 2048) {
        try {
          records.push(JSON.parse(line));
        } catch {
          // Next.js diagnostics can also start with a brace.
        }
      }
    });
  }

  await eventually(() => {
    assert.ok(
      !spawnFailed && child.exitCode === null,
      `${app} exited during startup`,
    );

    return started;
  }, `${app} startup timed out`);

  return {
    origin,
    records,
    assertRedacted() {
      assert.ok(
        !leaked,
        `${app} diagnostics exposed a synthetic fixture value`,
      );
    },
  };
}

function request(origin, pathname) {
  return fetch(origin + pathname, {
    headers: browserHeaders,
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
  });
}

function browserRequestId(response) {
  assert.ok(
    !response.headers.has(signatureHeader),
    "Internal signature exposed",
  );
  assert.ok(
    !response.headers.has(renderIdHeader),
    "Internal render ID exposed",
  );
  const id = response.headers.get(requestIdHeader);
  assert.ok(uuid.test(id) && id !== browserId, "Browser ID was not replaced");

  return id;
}

function eventFor(app, service, requestId) {
  return eventually(
    () =>
      app.records.find(
        (event) => event.service === service && event.requestId === requestId,
      ),
    `Missing correlated ${service} event`,
  );
}

function assertFailure(record, expected) {
  assert.ok(
    Number.isFinite(Date.parse(record.timestamp)),
    "Invalid event timestamp",
  );
  const { timestamp: _timestamp, ...fields } = record;
  assert.ok(
    isDeepStrictEqual(fields, {
      category: "operational",
      level: "error",
      outcome: "failure",
      status: 500,
      ...expected,
    }),
    `${expected.service} event fields did not match the expected allowlist`,
  );
}

function assertClientBundles() {
  for (const app of ["admin", "web"]) {
    const directory = `apps/${app}/.next-e2e/static`;
    const scripts = readdirSync(directory, {
      recursive: true,
      withFileTypes: true,
    }).filter((entry) => entry.isFile() && /\.js(?:\.map)?$/.test(entry.name));

    assert.ok(scripts.length > 0, `Missing ${app} browser bundles`);

    for (const entry of scripts) {
      const script = readFileSync(
        path.join(entry.parentPath, entry.name),
        "utf8",
      );
      assert.ok(
        !script.includes(signingKey) && !script.includes(signingVariable),
        `${app} browser bundle exposed signing configuration`,
      );
    }
  }
}

async function verify() {
  for (const app of ["api", "admin", "web"]) {
    assert.ok(
      existsSync(standalonePath(app)),
      `Missing ${app} standalone build (.next-e2e)`,
    );
  }

  assertClientBundles();
  // Refuse database connections deterministically without reaching any existing database.
  const databasePort = await listen(
    createTcpServer((socket) => socket.destroy()),
  );
  const environment = {
    DATABASE_URL: `postgresql://fixture:fixture@${host}:${databasePort}/${databaseName}?connect_timeout=1`,
    BETTER_AUTH_URL: "http://127.0.0.1:49101",
    BETTER_AUTH_SECRET: authKey,
    SITE_URL: "http://127.0.0.1:49100",
    [signingVariable]: signingKey,
  };
  const api = await start("api", environment);
  const observed = new Map();
  const gateway = createServer(async (incoming, outgoing) => {
    try {
      const pathname = new URL(incoming.url, api.origin).pathname;
      const id = incoming.headers[requestIdHeader];
      const signature = incoming.headers[signatureHeader];
      observed.set(pathname, {
        id,
        signed:
          typeof signature === "string" && /^[0-9a-f]{64}$/.test(signature),
      });

      if (pathname === paths.redirect) {
        outgoing
          .writeHead(302, {
            location: redirectLocation,
            "set-cookie": cookies,
            [signatureHeader]: signature,
          })
          .end();

        return;
      }

      const headers = new Headers();

      for (const name of [requestIdHeader, signatureHeader]) {
        if (typeof incoming.headers[name] === "string") {
          headers.set(name, incoming.headers[name]);
        }
      }

      const response = await fetch(api.origin + pathname, {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      });

      const body = await response.text();
      outgoing
        .writeHead(response.status, {
          "content-type": "application/json",
          [requestIdHeader]: response.headers.get(requestIdHeader) ?? "",
        })
        .end(body);
    } catch {
      outgoing.writeHead(502).end();
    }
  });

  const gatewayPort = await listen(gateway);
  const frontend = {
    ...environment,
    API_INTERNAL_ORIGIN: `http://${host}:${gatewayPort}`,
  };

  for (const sharedKey of [true, false]) {
    const admin = await start("admin", {
      ...frontend,
      [signingVariable]: sharedKey ? signingKey : wrongKey,
    });

    const web = await start("web", {
      ...frontend,
      [signingVariable]: sharedKey ? signingKey : "",
    });

    const health = await request(admin.origin, paths.health);
    assert.equal(health.status, 200);
    assert.ok(isDeepStrictEqual(await health.json(), { status: "ok" }));
    browserRequestId(health);

    for (const [app, service, upstreamPath, browserPath, status, operation] of [
      [admin, "admin", paths.settings, paths.settings, 500, "forward"],
      [
        web,
        "web",
        paths.media,
        "/media/correlation-fixture",
        503,
        "public.media",
      ],
    ]) {
      const response = await request(app.origin, browserPath);
      assert.equal(response.status, status, `${service} HTTP status`);
      const responseId = browserRequestId(response);
      const { id, signed } = observed.get(upstreamPath);
      assert.ok(uuid.test(id) && id !== browserId, "Invalid forwarded ID");
      assert.equal(signed, sharedKey || service === "admin");
      const failure = await eventFor(app, service, id);
      const apiId = sharedKey ? id : failure.upstreamRequestId;
      assert.ok(
        uuid.test(apiId) && apiId !== browserId,
        "Invalid effective API ID",
      );
      assert.equal(apiId === id, sharedKey);
      assert.equal(responseId, service === "admin" ? apiId : id);
      assertFailure(failure, {
        service,
        event:
          service === "admin"
            ? "admin.upstream.failed"
            : "public.upstream.failed",
        operation,
        code: "upstream",
        requestId: id,
        ...(sharedKey ? {} : { upstreamRequestId: apiId }),
      });
      assertFailure(await eventFor(api, "api", apiId), {
        service: "api",
        event: "api.request.failed",
        operation: service === "admin" ? "public.settings" : "public.media",
        code: "database",
        requestId: apiId,
      });
      const body = await response.text();
      assert.ok(
        !body.includes(databaseName),
        "Database diagnostic was exposed",
      );
    }

    const localized = await request(web.origin, "/posts");
    assert.equal(localized.status, 308);
    const location = localized.headers.get("location");
    assert.ok(
      location &&
        new URL(location, web.origin).href === `${web.origin}/en/posts`,
    );
    browserRequestId(localized);

    const redirect = await request(admin.origin, paths.redirect);
    assert.equal(redirect.status, 302);
    assert.ok(
      redirect.headers.get("location") === redirectLocation,
      "OAuth redirect location changed",
    );
    assert.ok(
      isDeepStrictEqual(redirect.headers.getSetCookie(), cookies),
      "OAuth cookies changed",
    );
    browserRequestId(redirect);

    assert.equal(admin.records.length, 1, "Unexpected Admin log record count");
    assert.equal(web.records.length, 1, "Unexpected Web log record count");
    admin.assertRedacted();
    web.assertRedacted();
  }

  assert.equal(api.records.length, 4, "Unexpected API log record count");
  api.assertRedacted();
  console.log(
    "Standalone Admin, Web, and API correlation and HTTP forwarding passed.",
  );
}

try {
  await verify();
} finally {
  await Promise.all([
    ...Array.from(listeners, close),
    ...Array.from(children, async (child) => {
      if (child.pid && child.exitCode === null && child.signalCode === null) {
        const exited = once(child, "exit", {
          signal: AbortSignal.timeout(5_000),
        });
        child.kill("SIGKILL");
        await exited;
      }
    }),
  ]);
}
