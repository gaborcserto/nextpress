import { z } from "zod";

import type { SpawnSyncReturns } from "node:child_process";

const reportSchema = z.object({
  numPassedTests: z.number(),
  numFailedTests: z.number(),
  numPendingTests: z.number(),
  numFailedTestSuites: z.number(),
  testResults: z.array(
    z.object({
      message: z.string().optional(),
      assertionResults: z.array(
        z.object({
          fullName: z.string(),
          status: z.string(),
          failureMessages: z.array(z.string()),
        }),
      ),
    }),
  ),
});

export function subprocessFailureMetadata(error: unknown) {
  const metadata = z
    .object({
      code: z.string().optional(),
      status: z.number().nullable().optional(),
      signal: z.string().nullable().optional(),
    })
    .safeParse(error);

  return metadata.success ? JSON.stringify(metadata.data) : "unavailable";
}

export function redactVerificationOutput(
  value: string,
  environment: Record<string, string | undefined> = process.env,
) {
  let output = value;

  for (const [name, secret] of Object.entries(environment)) {
    if (!secret || !/secret|password|token|database_url/i.test(name)) {
      continue;
    }
    output = output.replaceAll(secret, "[redacted]");

    if (/database_url/i.test(name)) {
      try {
        const password = new URL(secret).password;

        if (password) {
          output = output.replaceAll(password, "[redacted]");
        }
      } catch {
        // Invalid environment URLs must not prevent failure diagnostics.
      }
    }
  }

  return output.replace(
    /postgres(?:ql)?:\/\/[^\s]+/g,
    "[redacted database URL]",
  );
}

export function inspectVerificationProcess(
  result: SpawnSyncReturns<string>,
  tests: boolean,
) {
  let report: z.infer<typeof reportSchema> | undefined;

  if (tests) {
    try {
      report = reportSchema.parse(JSON.parse(result.stdout));
    } catch {
      // Preserve the process outcome even when a crash leaves invalid JSON.
    }
  }
  let outcome = "passed";

  if (
    result.error &&
    "code" in result.error &&
    result.error.code === "ETIMEDOUT"
  ) {
    outcome = "timeout";
  } else if (result.signal) {
    outcome = "signal termination";
  } else if (result.error) {
    outcome = "process execution failure";
  } else if (report && report.numFailedTests > 0) {
    outcome = "test assertion failure";
  } else if (report && report.numFailedTestSuites > 0) {
    outcome = "test suite or hook failure";
  } else if (result.status !== 0) {
    outcome = "abnormal exit without established assertion failure";
  } else if (tests && !report) {
    outcome = "invalid test report";
  }

  return { outcome, report };
}
