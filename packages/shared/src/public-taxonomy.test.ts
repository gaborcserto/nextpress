import { expect, it } from "vitest";

import {
  PublicTaxonomyBatchSchema,
  PublicTagBatchSchema,
  PublicTaxonomyParamsSchema,
} from "./api-contracts";

it.each(["news", "arvizturo", "a-1"])(
  "accepts canonical taxonomy slug %s",
  (slug) => {
    expect(
      PublicTaxonomyParamsSchema.safeParse({ type: "TAG", slug }).success,
    ).toBe(true);
  },
);
it.each(["", " news ", "../private", "a/b", "UPPER", "a%2Fb", "a".repeat(201)])(
  "rejects invalid taxonomy slug %s",
  (slug) => {
    expect(
      PublicTaxonomyParamsSchema.safeParse({ type: "TAG", slug }).success,
    ).toBe(false);
  },
);
it("keeps taxonomy archives explicit and rejects administrative fields", () => {
  const batch = {
    taxonomy: { type: "CATEGORY", slug: "design", name: "Design" },
    posts: [],
    hasMore: false,
  };
  expect(PublicTaxonomyBatchSchema.parse(batch)).toEqual(batch);
  expect(
    PublicTaxonomyBatchSchema.safeParse({
      ...batch,
      taxonomy: { ...batch.taxonomy, id: "private" },
    }).success,
  ).toBe(false);
  expect(
    PublicTaxonomyParamsSchema.safeParse({ type: "PRIVATE", slug: "design" })
      .success,
  ).toBe(false);
});

it("bounds public tag collections and rejects invalid or internal entries", () => {
  const tag = { type: "TAG", slug: "news", name: "News" };
  expect(
    PublicTagBatchSchema.safeParse({ tags: [tag], hasMore: false }).success,
  ).toBe(true);
  expect(
    PublicTagBatchSchema.safeParse({
      tags: Array.from({ length: 51 }, () => tag),
      hasMore: true,
    }).success,
  ).toBe(false);
  for (const invalid of [
    { ...tag, type: "CATEGORY" },
    { ...tag, slug: "../bad" },
    { ...tag, id: "internal" },
  ]) {
    expect(
      PublicTagBatchSchema.safeParse({ tags: [invalid], hasMore: false })
        .success,
    ).toBe(false);
  }
});
