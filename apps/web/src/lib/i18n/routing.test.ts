import { describe, expect, it } from "vitest";

import { localizedHref, pathLocale, stripLocalePrefix } from "./routing";
describe("public locale routing", () => {
  it.each([
    "/",
    "/posts",
    "/posts/story",
    "/pages/about",
    "/tags",
    "/tags/news",
    "/categories/design",
    "/search?q=story&page=2",
  ])("prefixes %s consistently", (path) => {
    expect(localizedHref(path, "hu")).toBe(`/hu${path}`);
  });
  it("switches language without inventing slugs or discarding query and hash", () => {
    expect(
      localizedHref(
        "/en/posts/original-slug?page=2&q=hello%20world#article",
        "hu",
      ),
    ).toBe("/hu/posts/original-slug?page=2&q=hello%20world#article");
    expect(localizedHref("/hu/", "en")).toBe("/en/");
    expect(localizedHref("/hu/posts/", "hu")).toBe("/hu/posts");
  });
  it.each([
    "/api/public/posts",
    "/admin",
    "/auth/login",
    "/live-preview",
    "/media/image",
    "/favicon.ico",
    "/_next/static/test.js",
    "https://example.com/posts",
    "//example.com/posts",
    "#section",
  ])("leaves non-public destination %s alone", (path) => {
    expect(localizedHref(path, "hu")).toBe(path);
  });
  it("validates locale segments", () => {
    expect(pathLocale("/hu/posts")).toBe("hu");
    expect(pathLocale("/hungarian/posts")).toBeUndefined();
    expect(stripLocalePrefix("/hu/posts/story")).toBe("/posts/story");
  });
});
