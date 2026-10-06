import { describe, expect, it } from "vitest";

import { getMaxPostsPage, parsePostsPage } from "./post-archive";

describe("parsePostsPage", () => {
  it.each([undefined, ["2", "3"], "", "0", "-2", "2.5", "1e2", "100002", "99999999999999999999"])(
    "normalizes invalid page value %s to the first page",
    (value) => expect(parsePostsPage(value)).toBe(1)
  );

  it("accepts bounded positive integer pages", () => {
    expect(parsePostsPage("2")).toBe(2);
    expect(parsePostsPage(String(getMaxPostsPage()))).toBe(getMaxPostsPage());
    expect(parsePostsPage("20002", 5)).toBe(1);
  });
});
