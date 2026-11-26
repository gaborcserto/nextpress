import { describe, expect, it } from "vitest";

import { isSlugConflictError } from "./content-conflicts";

describe("isSlugConflictError", () => {
  it("recognizes only objects with the conflict code", () => {
    expect(isSlugConflictError({ code: "SLUG_CONFLICT" })).toBe(true);
    expect(isSlugConflictError({ code: "OTHER" })).toBe(false);
    expect(isSlugConflictError(new Error("conflict"))).toBe(false);
    expect(isSlugConflictError(null)).toBe(false);
  });
});
