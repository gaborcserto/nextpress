import { prisma } from "@nextpress/db/src/client";
import { readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { z } from "zod";

// Standalone Node needs the server marker alias supplied by Next server builds.
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === "server-only"
        ? "next/dist/compiled/server-only/empty.js"
        : specifier,
      context,
    );
  },
});

const ownershipSchema = z.object({
  owner: z.uuid(),
  generation: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(BigInt),
});
const commandSchema = z.enum([
  "dry-run",
  "acquire",
  "execute",
  "renew",
  "release",
  "seal",
  "unseal",
]);

async function main() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("DEVELOPMENT_MODE_REQUIRED");
  }

  const {
    executeLegacyBatches,
    inspectLegacyExecution,
    LegacyExecutionSchema,
    preflightLegacyExecution,
  } = await import("../src/lib/services/legacy-backfill-execution.server");
  const {
    acquireBackfillOwnership,
    releaseBackfillOwnership,
    renewBackfillOwnership,
  } = await import("../src/lib/services/legacy-backfill-fence.server");
  const { transitionLegacyOwnership } =
    await import("../src/lib/services/legacy-writer-ownership.server");
  const command = commandSchema.parse(process.argv[2]);
  const cohortPath = z.string().min(1).parse(process.argv[3]);
  const cohort = LegacyExecutionSchema.parse(
    JSON.parse(readFileSync(cohortPath, "utf8")),
  );

  if (command === "dry-run") {
    console.log(JSON.stringify(await inspectLegacyExecution(prisma, cohort)));

    return;
  }

  const tokenPath = z.string().min(1).parse(process.argv[4]);
  await preflightLegacyExecution(prisma);

  if (command === "acquire") {
    // Exclusive creation prevents overwriting a still-useful recovery token.
    const ownership = await acquireBackfillOwnership(prisma);
    writeFileSync(
      tokenPath,
      JSON.stringify({
        ...ownership,
        generation: ownership.generation.toString(),
      }),
      { flag: "wx", mode: 0o600 },
    );
    console.log("BACKFILL_OWNERSHIP_ACQUIRED");

    return;
  }

  const ownership = ownershipSchema.parse(
    JSON.parse(readFileSync(tokenPath, "utf8")),
  );

  if (command === "execute") {
    console.log(
      JSON.stringify(await executeLegacyBatches(prisma, ownership, cohort)),
    );
  } else if (command === "renew") {
    await renewBackfillOwnership(prisma, ownership);
  } else if (command === "release") {
    await releaseBackfillOwnership(prisma, ownership);
  } else {
    for (const pageId of [...new Set(cohort.pageIds)].sort()) {
      await renewBackfillOwnership(prisma, ownership);
      await transitionLegacyOwnership(
        prisma,
        ownership,
        pageId,
        command === "seal" ? "READY" : "SHADOW",
      );
    }
  }
}

main()
  .catch(() => {
    // Raw Prisma errors and operator input can contain content or credentials.
    console.error(
      "BACKFILL_COMMAND_FAILED: inspect read-only diagnostics before recovery; no automatic fence release",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
