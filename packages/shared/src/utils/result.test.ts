import { describe, expect, it } from "vitest";

import { tryCatch } from "./result";

describe("tryCatch", () => {
  it("returns resolved data without an error", async () => {
    await expect(tryCatch(Promise.resolve("ready"))).resolves.toEqual([
      "ready",
      null,
    ]);
  });
});
