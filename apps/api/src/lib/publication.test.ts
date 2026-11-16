import { afterEach, describe, expect, it, vi } from "vitest";

import { resolvePublicationDate } from "./publication";

const now = new Date("2026-11-17T12:00:00.000Z");
const past = new Date("2026-01-01T12:00:00.000Z");
const future = new Date("2026-12-01T12:00:00.000Z");

afterEach(() => vi.useRealTimers());

describe("publication timestamp contract for Posts and Pages", () => {
  it("creates private drafts without inventing a publication date", () => {
    expect(resolvePublicationDate(null, { status: "DRAFT" }, now)).toBeNull();
  });

  it("publishes undated content at the server clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(resolvePublicationDate(null, { status: "PUBLISHED" })).toEqual(now);
  });

  it.each([past, future])(
    "preserves publication history or schedule on saves and revision publish: %s",
    (publishedAt) => {
      const current = { status: "PUBLISHED" as const, publishedAt };
      expect(resolvePublicationDate(current, {}, now)).toEqual(publishedAt);
      expect(
        resolvePublicationDate(current, { status: "PUBLISHED" }, now),
      ).toEqual(publishedAt);
      expect(resolvePublicationDate(current, { status: "DRAFT" }, now)).toEqual(
        publishedAt,
      );
    },
  );

  it("requires an explicit date clear to replace a schedule with immediate publication", () => {
    expect(
      resolvePublicationDate(
        { status: "PUBLISHED", publishedAt: future },
        { publishedAt: null },
        now,
      ),
    ).toEqual(now);
    expect(
      resolvePublicationDate(
        { status: "DRAFT", publishedAt: past },
        { publishedAt: null },
        now,
      ),
    ).toBeNull();
  });

  it("does not reinterpret historical undated content on partial save", () => {
    expect(
      resolvePublicationDate(
        { status: "PUBLISHED", publishedAt: null },
        {},
        now,
      ),
    ).toBeNull();
  });

  it("republishing preserves the historical instant unless deliberately changed", () => {
    expect(
      resolvePublicationDate(
        { status: "DRAFT", publishedAt: past },
        { status: "PUBLISHED" },
        now,
      ),
    ).toEqual(past);
  });

  it("normalizes offset dates to the same UTC instant across a day boundary", () => {
    expect(
      resolvePublicationDate(
        null,
        { status: "PUBLISHED", publishedAt: "2026-11-18T00:30:00+02:00" },
        now,
      ),
    ).toEqual(new Date("2026-11-17T22:30:00Z"));
  });
});
