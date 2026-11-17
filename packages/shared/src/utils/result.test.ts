import { describe, expect, it } from "vitest";

import { tryCatch, unwrapResult } from "./result";

describe("tryCatch", () => {
  it("returns resolved data without an error", async () => {
    await expect(tryCatch(Promise.resolve("ready"))).resolves.toEqual([
      "ready",
      null,
    ]);
  });
});

it("preserves null successes and normalizes arbitrary rejection values", async () => {
  expect(unwrapResult(await tryCatch(Promise.resolve(null)))).toBeNull();
  for (const reason of [null, undefined, "failure", 0]) {
    const result = await tryCatch(Promise.reject(reason));
    expect(result[1]).toBeInstanceOf(Error);
    expect(() => unwrapResult(result)).toThrow("Unknown error");
  }
});
