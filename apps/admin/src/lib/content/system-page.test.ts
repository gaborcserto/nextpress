import { describe, expect, it } from "vitest";

import { isSystemPage } from "./system-page";

describe("isSystemPage", () => {
  it("recognizes the configured Home and Posts pages", () => {
    expect(isSystemPage("HOME", "homepage")).toBe(true);
    expect(isSystemPage("POSTS", "posts")).toBe(true);
  });

  it("does not classify ordinary pages or posts as system pages", () => {
    expect(isSystemPage("STANDARD", "posts")).toBe(false);
    expect(isSystemPage("POSTS", "news")).toBe(false);
    expect(isSystemPage(undefined, "home")).toBe(false);
  });
});
