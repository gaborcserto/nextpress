import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import {
  inspectVerificationProcess,
  redactVerificationOutput,
  subprocessFailureMetadata,
} from "./verification-process";

const report = {
  numPassedTests: 1,
  numFailedTests: 0,
  numPendingTests: 0,
  numFailedTestSuites: 0,
  testResults: [],
};

function child(output: string, exitCode: number) {
  return spawnSync(
    process.execPath,
    [
      "-e",
      "process.stdout.write(process.argv[1]); process.exitCode = Number(process.argv[2])",
      output,
      String(exitCode),
    ],
    { encoding: "utf8" },
  );
}

describe("verification process diagnostics", () => {
  it("retains Docker exit metadata without command arguments or credential output", () => {
    expect(
      subprocessFailureMetadata(
        Object.assign(new Error("private command"), {
          code: "ETIMEDOUT",
          status: null,
          signal: "SIGTERM",
          stderr: "credentials",
        }),
      ),
    ).toBe('{"code":"ETIMEDOUT","status":null,"signal":"SIGTERM"}');
  });
  it("keeps an abnormal exit distinct from a passing report", () => {
    const result = inspectVerificationProcess(
      child(JSON.stringify(report), 1),
      true,
    );
    expect(result.outcome).toBe(
      "abnormal exit without established assertion failure",
    );
    expect(result.report?.numPassedTests).toBe(1);
  });

  it("reports failed assertions and hooks separately", () => {
    expect(
      inspectVerificationProcess(
        child(JSON.stringify({ ...report, numFailedTests: 1 }), 1),
        true,
      ).outcome,
    ).toBe("test assertion failure");
    expect(
      inspectVerificationProcess(
        child(JSON.stringify({ ...report, numFailedTestSuites: 1 }), 1),
        true,
      ).outcome,
    ).toBe("test suite or hook failure");
  });

  it("preserves crash evidence when JSON is incomplete", () => {
    expect(
      inspectVerificationProcess(child('{"numPassedTests":', 1), true).outcome,
    ).toBe("abnormal exit without established assertion failure");
    expect(inspectVerificationProcess(child("invalid", 0), true).outcome).toBe(
      "invalid test report",
    );
  });

  it("recognizes subprocess timeout and signal termination", () => {
    const result = spawnSync(
      process.execPath,
      ["-e", "setTimeout(() => {}, 10000)"],
      { encoding: "utf8", timeout: 200 },
    );
    expect(inspectVerificationProcess(result, true).outcome).toBe("timeout");
    expect(
      inspectVerificationProcess(
        { ...result, error: undefined, signal: "SIGTERM" },
        true,
      ).outcome,
    ).toBe("signal termination");
  });

  it("accepts a complete successful test report", () => {
    expect(
      inspectVerificationProcess(child(JSON.stringify(report), 0), true)
        .outcome,
    ).toBe("passed");
  });

  it("redacts every output stream and tolerates malformed environment URLs", () => {
    const env = {
      DATABASE_URL: "postgresql://user:credential@localhost/db",
      OTHER_DATABASE_URL: "invalid",
      AUTH_SECRET: "secret-value",
    };
    expect(
      redactVerificationOutput(
        `${env.DATABASE_URL} credential secret-value postgresql://other:hidden@localhost/db`,
        env,
      ),
    ).toBe("[redacted] [redacted] [redacted] [redacted database URL]");
  });
});
