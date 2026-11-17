import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { z } from "zod";

import { disposableDatabaseName } from "../src/lib/testing/disposable-database";
import {
  disposableManifestPath,
  disposableDockerContext,
  verifyDockerEvidence,
  verifyDisposableDatabase,
  verifyDockerTarget,
  verifyLocalDocker,
  verifyProvisioningCleanup,
  type DisposableManifest,
} from "../src/lib/testing/docker-database";

function docker(...args: string[]) {
  try {
    return execFileSync(
      "docker",
      ["--context", disposableDockerContext().name, ...args],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
      },
    ).trim();
  } catch {
    throw new Error(
      "Docker verification command failed (credential output suppressed)",
    );
  }
}

function npm(args: string[]) {
  const tests = args.includes("test");
  const command = ["--silent", ...args, ...(tests ? ["--reporter=json"] : [])];
  const result = spawnSync("npm", command, {
    shell: process.platform === "win32",
    // Prisma and test diagnostics can contain generated database identities.
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    env: process.env,
  });

  if (result.status !== 0) {
    if (tests && result.stdout) {
      const report = z
        .object({
          testResults: z.array(
            z.object({
              assertionResults: z.array(
                z.object({
                  fullName: z.string(),
                  status: z.string(),
                  failureMessages: z.array(z.string()),
                }),
              ),
            }),
          ),
        })
        .parse(JSON.parse(result.stdout));

      for (const suite of report.testResults) {
        for (const test of suite.assertionResults) {
          if (test.status === "failed") {
            console.error(
              test.fullName,
              test.failureMessages
                .join("\n")
                .replace(
                  /postgres(?:ql)?:\/\/[^\s]+/g,
                  "[redacted database URL]",
                ),
            );
          }
        }
      }
    }
    throw new Error(`Verification command failed: npm ${args.join(" ")}`);
  }

  if (tests) {
    const counts = z
      .object({
        numPassedTests: z.number(),
        numFailedTests: z.number(),
        numPendingTests: z.number(),
      })
      .parse(JSON.parse(result.stdout));
    console.log(
      `PostgreSQL tests: ${counts.numPassedTests} passed, ${counts.numFailedTests} failed, ${counts.numPendingTests} skipped`,
    );
  } else {
    console.log(
      "Existing migrations applied to the verified disposable target",
    );
  }
}

function sql(container: string, database: string, statement: string) {
  try {
    return execFileSync(
      "docker",
      [
        "--context",
        disposableDockerContext().name,
        "exec",
        "-i",
        container,
        "psql",
        "-XAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "b04_provisioner",
        "-d",
        database,
      ],
      {
        input: statement,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 30000,
      },
    ).trim();
  } catch {
    throw new Error("Disposable SQL failed (credential output suppressed)");
  }
}

function removeNetwork(network: string, run: string) {
  const [ownedNetwork] = z
    .array(
      z.object({
        Id: z.string(),
        Labels: z.record(z.string(), z.string()),
        Containers: z.record(z.string(), z.unknown()),
      }),
    )
    .length(1)
    .parse(JSON.parse(docker("network", "inspect", network)));

  if (
    !ownedNetwork ||
    ownedNetwork.Id !== network ||
    ownedNetwork.Labels["nextpress.disposable"] !== run ||
    Object.keys(ownedNetwork.Containers).length
  ) {
    throw new Error(
      "Refusing cleanup of an unowned or shared disposable network",
    );
  }
  docker("network", "rm", network);
}

async function verifyFamily(family: "content" | "security") {
  verifyLocalDocker();
  const run = randomBytes(6).toString("hex");
  const database = `nextpress_${family === "content" ? "phase1" : "security"}_verify_${run}`;
  const networkName = `nextpress-b04-${run}`;
  const password = randomBytes(32).toString("hex");
  const nonce = randomBytes(32).toString("hex");
  const port = family === "content" ? 55432 : 55433;
  const reference =
    "postgres@sha256:073e7c8b84e2197f94c8083634640ab37105effe1bc853ca4d5fbece3219b0e8";
  docker("pull", reference);
  const image = docker("image", "inspect", reference, "--format", "{{.Id}}");
  const network = docker(
    "network",
    "create",

    "--driver",
    "bridge",
    "--label",
    `nextpress.disposable=${run}`,
    networkName,
  );
  let container: string | undefined;
  let manifest: DisposableManifest | undefined;
  let clusterVerified = false;
  let evidenceCreated = false;

  try {
    container = docker(
      "create",
      "--name",
      `nextpress-b04-disposable-${run}`,
      "--label",
      `nextpress.disposable=${run}`,
      "--network",
      networkName,
      "--publish",
      `127.0.0.1:${port}:5432`,
      "--tmpfs",
      "/var/lib/postgresql:rw",
      "--env",
      `POSTGRES_PASSWORD=${password}`,
      "--env",
      "POSTGRES_USER=b04_provisioner",
      "--env",
      `POSTGRES_DB=${database}`,
      image,
    );
    docker("start", container);
    const endpoints = z
      .record(z.string(), z.object({ IPAddress: z.string() }))
      .parse(
        JSON.parse(
          docker(
            "inspect",
            container,
            "--format",
            "{{json .NetworkSettings.Networks}}",
          ),
        ),
      );
    const address = Object.values(endpoints)[0]?.IPAddress;

    if (!address) {
      throw new Error("Missing disposable endpoint");
    }
    manifest = {
      run,
      container,
      image,
      network,
      address,
      port,
      database,
      cluster: "0",
      nonce,
    };
    verifyDockerEvidence(
      manifest,
      JSON.parse(docker("inspect", container)),
      JSON.parse(docker("network", "inspect", network)),
    );
    let ready = false;

    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        if (sql(container, database, "SELECT 1") === "1") {
          ready = true;
          break;
        }
      } catch {
        // Initialization has a bounded readiness deadline; no database mutation is retried.
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!ready) {
      throw new Error("Disposable cluster did not start");
    }
    manifest.cluster = sql(
      container,
      database,
      "SELECT system_identifier FROM pg_control_system()",
    );
    verifyDockerTarget(manifest);
    clusterVerified = true;

    // First mutations occur only on the newly created, independently inspected cluster.
    sql(
      container,
      database,
      `
    CREATE ROLE b04_runtime LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    REVOKE ALL ON DATABASE postgres, template0, template1 FROM PUBLIC;
    REVOKE ALL ON DATABASE ${database} FROM PUBLIC;
    GRANT CONNECT ON DATABASE ${database} TO b04_runtime;
    ALTER SCHEMA public OWNER TO b04_runtime;
    CREATE SCHEMA b04_identity AUTHORIZATION b04_provisioner;
    CREATE TABLE b04_identity.marker(nonce text NOT NULL);
    INSERT INTO b04_identity.marker VALUES ('${nonce}');
    GRANT USAGE ON SCHEMA b04_identity TO b04_runtime;
    GRANT SELECT ON b04_identity.marker TO b04_runtime;
    GRANT EXECUTE ON FUNCTION pg_control_system() TO b04_runtime;
  `,
    );
    const url = `postgresql://b04_runtime:${password}@127.0.0.1:${port}/${database}`;
    process.env.DATABASE_URL = url;
    delete process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
    delete process.env.NEXTPRESS_SECURITY_TEST_DATABASE_URL;
    const optIn =
      family === "content"
        ? "NEXTPRESS_CONTENT_TEST_DATABASE_URL"
        : "NEXTPRESS_SECURITY_TEST_DATABASE_URL";
    process.env[optIn] = url;
    // Derive maintenance identity from this independently verified disposable run.
    process.env.NEXTPRESS_BACKFILL_DATABASE_NAME = manifest.database;
    process.env.NEXTPRESS_BACKFILL_CLUSTER_ID = manifest.cluster;
    process.env.NEXTPRESS_BACKFILL_DATABASE_ROLE = "b04_runtime";
    // This process imports the singleton only once; families run in separate processes.
    const { prisma } = await import("@nextpress/db/src/client");

    try {
      await verifyDisposableDatabase(
        disposableDatabaseName(url, url, family),
        prisma,
        manifest,
      );
      // Exclusive creation prevents overwriting evidence owned by another run.
      writeFileSync(disposableManifestPath, JSON.stringify(manifest), {
        flag: "wx",
        mode: 0o600,
      });
      evidenceCreated = true;
      npm(["--workspace", "@nextpress/db", "run", "prisma:deploy"]);
      await verifyDisposableDatabase(database, prisma, manifest);
      sql(
        container,
        database,
        `INSERT INTO "Role" (id,name) VALUES ('b04-admin','ADMIN'),('b04-editor','EDITOR'),('b04-author','AUTHOR'),('b04-subscriber','SUBSCRIBER') ON CONFLICT DO NOTHING;`,
      );

      if (family === "content") {
        npm([
          "--workspace",
          "api",
          "test",
          "--",
          "src/lib/repos/content-transaction.integration.test.ts",
          "src/lib/auth/user-administration.integration.test.ts",
          "src/lib/testing/postgres-feasibility.integration.test.ts",
          "src/lib/testing/working-aggregate-persistence.integration.test.ts",
          "src/lib/testing/editorial-persistence.integration.test.ts",
          "src/lib/testing/legacy-backfill.integration.test.ts",
          "src/lib/testing/legacy-backfill-fence.integration.test.ts",
          "--maxWorkers=1",
        ]);
      } else {
        npm([
          "--workspace",
          "api",
          "test",
          "--",
          "src/lib/auth/live-postgres.integration.test.ts",
          "--maxWorkers=1",
        ]);
      }
      await verifyDisposableDatabase(database, prisma, manifest);
      console.log(
        "Cleanup inventory",
        await prisma.user.count(),
        await prisma.page.count(),
        await prisma.taxonomy.count(),
      );
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    // Destruction requires the same evidence as provisioning. An identity
    // mismatch deliberately leaves resources for investigation.
    verifyLocalDocker();

    if (container) {
      if (clusterVerified && manifest) {
        verifyDockerTarget(manifest);
      } else {
        verifyProvisioningCleanup(
          { run, container, network, image, port },
          JSON.parse(docker("inspect", container)),
          JSON.parse(docker("network", "inspect", network)),
        );
      }
      docker("rm", "--force", container);
    }
    removeNetwork(network, run);

    if (evidenceCreated) {
      unlinkSync(disposableManifestPath);
    }
    console.log("Disposable cluster, network and evidence removed");
  }
}

const family = process.argv[2];

if (family !== "content" && family !== "security") {
  throw new Error("Specify content or security");
}
verifyFamily(family).catch(() => {
  console.error(
    "Disposable PostgreSQL verification failed; database diagnostics withheld",
  );
  process.exitCode = 1;
});
