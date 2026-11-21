import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

import { disposableDatabaseName } from "../src/lib/testing/disposable-database";
import {
  disposableManifestPath,
  disposableDockerContext,
  removeDisposableNetwork,
  verifyDockerEvidence,
  verifyDisposableDatabase,
  verifyDockerTarget,
  verifyLocalDocker,
  verifyProvisioningCleanup,
  watchDisposableInterrupt,
  type DisposableManifest,
} from "../src/lib/testing/docker-database";
import {
  inspectVerificationProcess,
  redactVerificationOutput,
  subprocessFailureMetadata,
} from "../src/lib/testing/verification-process";

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
  } catch (error) {
    throw new Error(
      `Docker ${args[0]} failed ${subprocessFailureMetadata(error)} (credential output suppressed)`,
    );
  }
}

function npm(args: string[]) {
  const tests = args.includes("test");
  const reportDirectory = tests
    ? mkdtempSync(join(tmpdir(), "nextpress-verification-"))
    : undefined;
  const reportPath = reportDirectory
    ? join(reportDirectory, "report.json")
    : undefined;
  const command = [
    "--silent",
    ...args,
    ...(reportPath
      ? [
          "--reporter=default",
          "--reporter=json",
          `--outputFile.json=${reportPath}`,
        ]
      : []),
  ];
  const result = spawnSync("npm", command, {
    shell: process.platform === "win32",
    // Prisma and test diagnostics can contain generated database identities.
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    env: process.env,
  });

  let reportOutput = "";

  if (reportPath && reportDirectory) {
    try {
      if (existsSync(reportPath)) {
        reportOutput = readFileSync(reportPath, "utf8");
      }
    } finally {
      if (existsSync(reportPath)) {
        unlinkSync(reportPath);
      }

      rmdirSync(reportDirectory);
    }
  }

  const { outcome, report } = inspectVerificationProcess(
    { ...result, stdout: tests ? reportOutput : result.stdout },
    tests,
  );

  if (outcome !== "passed") {
    const diagnostics = redactVerificationOutput(
      [
        `Outcome: ${outcome}`,
        `status=${result.status} signal=${result.signal} error=${result.error?.message ?? "none"}`,
        `stderr (${Buffer.byteLength(result.stderr ?? "")} bytes):`,
        result.stderr ?? "",
        `stdout (${Buffer.byteLength(result.stdout ?? "")} bytes):`,
        result.stdout ?? "",
        "JSON report:",
        reportOutput,
      ].join("\n"),
    );
    mkdirSync(new URL("../../../.notes/", import.meta.url), {
      recursive: true,
    });
    writeFileSync(
      new URL("../../../.notes/np-final-postgres-failure.txt", import.meta.url),
      diagnostics,
      { mode: 0o600 },
    );
    console.error(
      redactVerificationOutput(
        `Verification process: ${outcome}; status=${result.status}; signal=${result.signal}; error=${result.error?.message ?? "none"}`,
      ),
    );
    // Print each stream separately so a long JSON report cannot hide stderr.
    console.error("stderr:", redactVerificationOutput(result.stderr ?? ""));

    console.error("stdout:", redactVerificationOutput(result.stdout ?? ""));

    if (report) {
      console.error("Test report counts", {
        passed: report.numPassedTests,
        failed: report.numFailedTests,
        skipped: report.numPendingTests,
        failedSuites: report.numFailedTestSuites,
      });

      for (const suite of report.testResults) {
        if (suite.message) {
          console.error(redactVerificationOutput(suite.message));
        }

        for (const test of suite.assertionResults) {
          if (test.status === "failed") {
            console.error(
              redactVerificationOutput(
                `${test.fullName}\n${test.failureMessages.join("\n")}`,
              ),
            );
          }
        }
      }
    }

    throw new Error(
      `Verification command failed (${outcome}): npm ${args.join(" ")}`,
    );
  }

  if (report) {
    console.log(
      `PostgreSQL tests: ${report.numPassedTests} passed, ${report.numFailedTests} failed, ${report.numPendingTests} skipped`,
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
  } catch (error) {
    throw new Error(
      `Disposable SQL failed ${subprocessFailureMetadata(error)} (credential output suppressed)`,
    );
  }
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
  let network: string | undefined;
  let container: string | undefined;
  let manifest: DisposableManifest | undefined;
  let clusterVerified = false;
  let evidenceCreated = false;
  const interruption = watchDisposableInterrupt();

  try {
    network = docker(
      "network",
      "create",

      "--driver",
      "bridge",
      "--label",
      `nextpress.disposable=${run}`,
      networkName,
    );
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
    await interruption.checkpoint();
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
      await interruption.checkpoint();
      npm(["--workspace", "@nextpress/db", "run", "prisma:deploy"]);
      await interruption.checkpoint();
      await verifyDisposableDatabase(database, prisma, manifest);
      sql(
        container,
        database,
        `INSERT INTO "Role" (id,name) VALUES ('b04-admin','ADMIN'),('b04-editor','EDITOR'),('b04-author','AUTHOR'),('b04-subscriber','SUBSCRIBER') ON CONFLICT DO NOTHING;`,
      );

      if (family === "content") {
        // These suites assert complete user and public-content inventories.
        // Run them before the persistence suites retain rows in this cluster.
        npm([
          "--workspace",
          "api",
          "test",
          "--",
          "src/lib/auth/user-administration.integration.test.ts",
          "src/lib/repos/content-transaction.integration.test.ts",
          "--maxWorkers=1",
          "--testTimeout=30000",
        ]);
        await interruption.checkpoint();
        sql(
          container,
          database,
          `
          CREATE ROLE np_private_app LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
          GRANT CONNECT ON DATABASE ${database} TO np_private_app;
          GRANT USAGE ON SCHEMA public TO np_private_app;
          GRANT EXECUTE ON FUNCTION pg_control_system() TO np_private_app;
          GRANT SELECT ON "User","Role","Account","Session","OAuthProvider","SiteSettings",
            "Page","PageRevision","PageOnTaxonomy","PageMedia","Taxonomy","Media",
            "NavigationMenu","NavigationItem","NavigationAssignment",
            "ContentEditorialState","LegacyBackfillFence","NPContentFence","NPWorkingRevision",
            "NPWorkingMedia","NPWorkingTaxonomy","NPWorkingPage" TO np_private_app;
          GRANT INSERT, DELETE ON "Session" TO np_private_app;
          GRANT INSERT ON "NPContentFence","NPWorkingRevision","NPWorkingMedia","NPWorkingTaxonomy","NPWorkingPage" TO np_private_app;
          GRANT UPDATE ON "NPContentFence" TO np_private_app;
          GRANT UPDATE (id) ON "LegacyBackfillFence","Media","Taxonomy" TO np_private_app;
          -- Disposable cluster only, verified above and destroyed in finally.
          -- Narrow locked-read function avoids granting auth-table UPDATE.
          GRANT EXECUTE ON FUNCTION public.np_lock_publication_actor(text) TO np_private_app;
          -- Allow only the publication mapper's columns, never identity/ownership,
          -- specialized historical data, counters, Page DELETE or history UPDATE.
          GRANT UPDATE ("title","slug","content","excerpt","layout","listingTaxonomyId","pageDocument",
            "inHeaderMenu","inFooterMenu","status","publishedAt","workingVersion","updatedAt") ON "Page" TO np_private_app;
          GRANT INSERT ON "PageRevision","PageOnTaxonomy" TO np_private_app;
          GRANT DELETE ON "PageOnTaxonomy" TO np_private_app;
        `,
        );
        process.env.NEXTPRESS_PRIVATE_TEST_DATABASE_URL = `postgresql://np_private_app:${password}@127.0.0.1:${port}/${database}`;
        npm([
          "--workspace",
          "api",
          "test",
          "--",
          "src/lib/testing/postgres-feasibility.integration.test.ts",
          "src/lib/testing/working-aggregate-persistence.integration.test.ts",
          "src/lib/testing/editorial-persistence.integration.test.ts",
          "src/lib/testing/legacy-backfill.integration.test.ts",
          "src/lib/testing/legacy-backfill-fence.integration.test.ts",
          "src/lib/testing/private-draft-http.integration.test.ts",
          "--maxWorkers=1",
          "--testTimeout=30000",
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

      await interruption.checkpoint();
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
  } catch (error) {
    console.error(
      "PostgreSQL provisioning/database/test failure:",
      redactVerificationOutput(
        error instanceof Error ? error.message : String(error),
      ),
    );
    throw error;
  } finally {
    try {
      // Destruction requires the same evidence as provisioning. An identity
      // mismatch deliberately leaves resources for investigation.
      verifyLocalDocker();

      if (container && network) {
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

      if (network) {
        removeDisposableNetwork(network, run);
      }

      if (evidenceCreated) {
        unlinkSync(disposableManifestPath);
      }

      console.log("Disposable cluster, network and evidence removed");
    } catch (error) {
      console.error(
        `Cleanup failure for run ${run} (container ${container ?? "none"}, network ${network ?? "none"}):`,
        redactVerificationOutput(
          error instanceof Error ? error.message : String(error),
        ),
      );
      process.exitCode = 1;
    } finally {
      interruption.close();
    }
  }
}

const family = process.argv[2];

if (family !== "content" && family !== "security") {
  throw new Error("Specify content or security");
}

verifyFamily(family).catch((error: unknown) => {
  console.error(
    redactVerificationOutput(
      error instanceof Error ? error.message : String(error),
    ),
  );
  console.error(
    "Disposable PostgreSQL verification failed; sanitized diagnostics above",
  );
  process.exitCode = 1;
});
