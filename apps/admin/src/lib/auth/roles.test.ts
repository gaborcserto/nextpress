import { describe, expect, it } from "vitest";

import { isRole, ROLES } from "./roles";

describe("roles", () => {
  it("exposes the supported role names", () => {
    expect(ROLES).toEqual(["ADMIN", "EDITOR", "AUTHOR", "SUBSCRIBER"]);
  });

  it.each(ROLES)("accepts %s as a valid role", (role) => {
    expect(isRole(role)).toBe(true);
  });

  it.each([undefined, null, "admin", "OWNER", 1, {}])(
    "rejects invalid role state %s",
    (value) => {
      expect(isRole(value)).toBe(false);
    }
  );
});
