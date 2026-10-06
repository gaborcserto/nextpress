import { describe, expect, it } from "vitest";

import { MAX_POSTS_PAGE, parsePostsPage } from "./post-archive";

describe("parsePostsPage", () => {
  it.each([undefined, ["2", "3"], "", "0", "-2", "2.5", "1e2", "10001", "99999999999999999999"])(
    "normalizes invalid page value %s to the first page",
    (value) => expect(parsePostsPage(value)).toBe(1)
  );

  it("accepts bounded positive integer pages", () => {
    expect(parsePostsPage("2")).toBe(2);
    expect(parsePostsPage(String(MAX_POSTS_PAGE))).toBe(MAX_POSTS_PAGE);
  });
});
