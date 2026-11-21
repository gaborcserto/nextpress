import { expect, it } from "vitest";

import {
  DEFAULT_SITE_DATE_TIME,
  formatSiteDateTime,
  readSiteDateTime,
  SiteTimeZoneSchema,
} from "./site-date-time";

it.each([
  ["UTC", "2026-11-21, 23:54:23"],
  ["Europe/Budapest", "2026-11-22, 00:54:23"],
  ["Europe/London", "2026-11-21, 23:54:23"],
  ["America/New_York", "2026-11-21, 18:54:23"],
  ["Asia/Tokyo", "2026-11-22, 08:54:23"],
])("formats the same instant in %s", (timeZone, expected) => {
  expect(SiteTimeZoneSchema.parse(timeZone)).toBe(timeZone);
  expect(
    formatSiteDateTime(
      "2026-11-21T23:54:23Z",
      {
        timeZone,
        dateFormat: "iso",
        timeFormat: "24h-seconds",
      },
      "en-US",
    ),
  ).toBe(expected);
});

it.each(["+02:00", "Europe/Imaginary", "", "x".repeat(101)])(
  "rejects timezone %s",
  (timeZone) => {
    expect(SiteTimeZoneSchema.safeParse(timeZone).success).toBe(false);
    expect(readSiteDateTime({ ...DEFAULT_SITE_DATE_TIME, timeZone })).toEqual(
      DEFAULT_SITE_DATE_TIME,
    );
  },
);

it.each([
  ["ymd-dots", "2026.11.21."],
  ["iso", "2026-11-21"],
  ["dmy", "21/11/2026"],
  ["mdy", "11/21/2026"],
] as const)(
  "honors the %s preset regardless of locale date order",
  (dateFormat, expected) => {
    expect(
      formatSiteDateTime(
        "2026-11-21T14:54:23Z",
        {
          ...DEFAULT_SITE_DATE_TIME,
          dateFormat,
          timeFormat: "12h",
        },
        "en-US",
      ),
    ).toBe(`${expected}, 2:54 PM`);
  },
);
