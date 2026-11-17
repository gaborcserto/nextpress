import { describe, expect, it } from "vitest";

import { oops } from "./http";

describe("writer coordination diagnostics", () => {
  it.each(["55P03", "40001", "40P01", "P2034"])(
    "maps %s contention without exposing database details",
    async (code) => {
      const response = oops({
        meta: {
          driverAdapterError: {
            cause: { originalCode: code, originalMessage: "private SQL" },
          },
        },
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: "Content write conflict; retry the operation",
      });
    },
  );
  it.each(["P2003", "23001", "23503"])(
    "maps retained-reference %s to a sanitized conflict",
    async (code) => {
      const response = oops({
        code,
        meta: { private: "internal constraint details" },
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: "Content is retained by references",
      });
    },
  );
  it.each(["P5501", "P5502", "P5503"])(
    "maps wrapped PostgreSQL %s to a sanitized conflict",
    async (code) => {
      const response = oops({
        meta: {
          driverAdapterError: {
            cause: { originalCode: code, originalMessage: "private content" },
          },
        },
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: "Content maintenance conflict; retry after maintenance",
      });
    },
  );

  it("recognizes Prisma guard messages while retaining generic errors for unrelated failures", async () => {
    expect(
      oops(new Error("Prisma query: BACKFILL_WRITER_HELD; private content"))
        .status,
    ).toBe(409);
    const response = oops(new Error("private content"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unexpected error" });
  });
});
