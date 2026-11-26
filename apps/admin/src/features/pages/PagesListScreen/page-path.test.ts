import { describe, expect, it } from "vitest";

import { resolvePagePath } from "./page-path";

const rows = [
  { id: "home", slug: "home", layout: "HOME", parentId: null },
  { id: "posts", slug: "posts", layout: "POSTS", parentId: null },
  { id: "parent", slug: "company", layout: "STANDARD", parentId: null },
  { id: "child", slug: "team", layout: "STANDARD", parentId: "parent" },
];

describe("resolvePagePath", () => {
  it("uses canonical root paths for the protected system pages", () => {
    expect(resolvePagePath("home", rows)).toBe("/");
    expect(resolvePagePath("posts", rows)).toBe("/posts");
  });

  it("resolves nested paths from page hierarchy", () => {
    expect(resolvePagePath("child", rows)).toBe("/company/team");
  });
});
