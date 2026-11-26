import { expect, it } from "vitest";

import {
  publicationWallTime,
  resolvePublicationTime,
} from "./publication-time";

it.each(["1996-03-31T02:30", "2026-03-29T02:30", "2099-03-29T02:30"])(
  "rejects the Budapest gap at %s",
  (value) => {
    expect(resolvePublicationTime(value, "Europe/Budapest")).toEqual([]);
  },
);

it("returns both Budapest occurrences with their offsets and round-trips each", () => {
  const wallTime = "2026-10-25T02:30";
  const occurrences = resolvePublicationTime(wallTime, "Europe/Budapest");

  expect(occurrences).toEqual([
    { instant: "2026-10-25T00:30:00.000Z", offset: "+02:00" },
    { instant: "2026-10-25T01:30:00.000Z", offset: "+01:00" },
  ]);

  for (const { instant } of occurrences) {
    expect(
      publicationWallTime(instant, "Europe/Budapest").toString({
        smallestUnit: "minute",
      }),
    ).toBe(wallTime);
  }
});

it("uses the offset for the selected date when scheduling a future instant", () => {
  expect(resolvePublicationTime("2099-07-21T14:30", "Europe/Budapest")).toEqual(
    [{ instant: "2099-07-21T12:30:00.000Z", offset: "+02:00" }],
  );
});

it("round-trips a publication instant including seconds and milliseconds", () => {
  const instant = "2024-06-01T12:34:56.789Z";
  const wallTime = publicationWallTime(instant, "Europe/Budapest").toString();

  expect(resolvePublicationTime(wallTime, "Europe/Budapest")).toEqual([
    { instant, offset: "+02:00" },
  ]);
});
