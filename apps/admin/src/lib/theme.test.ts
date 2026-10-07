import { describe, expect, it } from "vitest";

import { normalizeThemeCookie } from "./theme";

describe("legacy admin theme cookie", () => {
  it.each(["light", "dark"])("preserves %s", (value) => {
    expect(normalizeThemeCookie(value)).toBe(value);
  });

  it("leaves an absent cookie to the OS-driven CSS", () => {
    expect(normalizeThemeCookie(undefined)).toBeUndefined();
  });

  it.each(["", "system", "sepia", "Dark", " dark ", null, {}, ["dark"], 1])(
    "uses explicit light mode for unsupported input %j",
    (value) => expect(normalizeThemeCookie(value)).toBe("light"),
  );
});
