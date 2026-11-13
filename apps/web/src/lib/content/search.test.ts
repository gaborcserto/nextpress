import { PublicSearchQuerySchema } from "@nextpress/shared/api-contracts";
import { expect, it } from "vitest";

import { parseSearchParams, searchHref } from "./search";

it("normalizes and bounds untrusted input", () => {
  expect(
    parseSearchParams({
      q: "  react   hooks ",
      page: "-2",
      sort: "bad",
      type: "bad",
      category: "!",
    }),
  ).toEqual({ q: "react hooks", page: 1, type: "all", sort: "relevance" });
  expect(
    PublicSearchQuerySchema.safeParse({ q: "x".repeat(201) }).success,
  ).toBe(false);
  expect(PublicSearchQuerySchema.safeParse({ page: 101 }).success).toBe(false);
  expect(parseSearchParams({ q: ["a", "b"] }).q).toBe("");
});

it("preserves supported URL filters and encodes the query for pagination", () => {
  const query = parseSearchParams({
    q: "a & b",
    category: "news",
    tag: "react",
    sort: "newest",
    type: "posts",
  });
  const url = new URL(searchHref(query, 2), "https://example.test");
  expect(Object.fromEntries(url.searchParams)).toEqual({ ...query, page: "2" });
  expect(
    parseSearchParams({ type: "pages", category: "news" }).category,
  ).toBeUndefined();
});
