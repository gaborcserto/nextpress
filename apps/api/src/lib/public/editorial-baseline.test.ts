import { PublicContentSchema } from "@nextpress/shared/api-contracts";
import { afterEach, expect, it, vi } from "vitest";

import { getPublishedPage, getPublishedPost } from "./content.server";
import {
  baselineHash,
  baselineInstant,
  canonicalBaseline,
  editorialFixtures,
  historicalDocuments,
} from "./editorial-baseline.fixtures";

const { findFirst, findMany } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock("@nextpress/db", () => ({
  prisma: {
    page: { findFirst, findMany },
    $transaction: (
      run: (tx: {
        page: { findFirst: typeof findFirst; findMany: typeof findMany };
      }) => unknown,
    ) => run({ page: { findFirst, findMany } }),
  },
}));

afterEach(() => vi.useRealTimers());

it.each(editorialFixtures)(
  "retains current public visibility: $type $scenario",
  async (fixture) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(baselineInstant));
    findFirst.mockImplementation(async ({ where }) => {
      expect(where.type).toBe(fixture.type);
      expect(where.status).toBe("PUBLISHED");
      expect(where.publishedAt).toEqual({
        not: null,
        lte: new Date(baselineInstant),
      });

      return fixture.status === where.status &&
        fixture.publishedAt &&
        fixture.publishedAt <= where.publishedAt.lte
        ? fixture
        : null;
    });
    findMany.mockResolvedValue([{ ...fixture, parentId: null }]);
    const result = await (
      fixture.type === "POST" ? getPublishedPost : getPublishedPage
    )(fixture.slug);

    if (!["past", "private-revision"].includes(fixture.scenario)) {
      expect(result).toBeNull();

      return;
    }

    expect(PublicContentSchema.safeParse(result).success).toBe(true);
    expect(result?.title).toBe(fixture.title);
    expect(result?.taxonomies.map((item) => item.type)).toEqual([
      "TAG",
      "CATEGORY",
    ]);
    expect(result?.content.blocks[0]).toMatchObject({
      children: [{ text: fixture.content }],
    });
    expect(JSON.stringify(result)).not.toContain("Private body");
  },
);

it.each([-1, 0, 1])("uses inclusive UTC boundary at %i ms", async (offset) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(baselineInstant));
  findFirst.mockImplementation(async ({ where }) =>
    new Date(Date.parse(baselineInstant) + offset) <= where.publishedAt.lte
      ? { ...editorialFixtures[1], publishedAt: new Date(baselineInstant) }
      : null,
  );
  expect(Boolean(await getPublishedPost("boundary"))).toBe(offset <= 0);
});

it("fingerprints complete stored data separately from public projections", () => {
  expect(baselineHash({ a: 1, b: null })).toBe(baselineHash({ b: null, a: 1 }));
  expect(baselineHash({})).not.toBe(baselineHash({ a: null }));
  expect(baselineHash([1, 2])).not.toBe(baselineHash([2, 1]));
  expect(() => canonicalBaseline({ a: undefined })).toThrow();
  const original = { ...editorialFixtures[1], publishedAt: baselineInstant };
  expect(baselineHash(original)).not.toBe(
    baselineHash({ ...original, gallery: [...original.gallery].reverse() }),
  );
  expect(baselineHash(historicalDocuments.unsupported)).not.toBe(
    baselineHash(historicalDocuments.supported),
  );
});
