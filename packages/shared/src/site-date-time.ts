import { z } from "zod";

export const SiteTimeZoneSchema = z
  .string()
  .max(100)
  .refine((value) => {
    if (!/^[a-zA-Z][a-zA-Z0-9_+/-]*$/.test(value)) {
      return false;
    }

    try {
      new Intl.DateTimeFormat("en", { timeZone: value });

      return true;
    } catch {
      return false;
    }
  })
  .meta({
    description:
      "Runtime-supported IANA time zone identifier, such as Europe/Budapest or UTC.",
  });

export const SiteDateTimeSchema = z.object({
  timeZone: SiteTimeZoneSchema,
  dateFormat: z.enum(["localized", "ymd-dots", "dmy", "mdy", "iso"]),
  timeFormat: z.enum(["24h", "24h-seconds", "12h", "12h-seconds"]),
});

export type SiteDateTime = z.infer<typeof SiteDateTimeSchema>;

export const DEFAULT_SITE_DATE_TIME: SiteDateTime = {
  timeZone: "UTC",
  dateFormat: "localized",
  timeFormat: "24h",
};

export function readSiteDateTime(value: unknown): SiteDateTime {
  const parsed = SiteDateTimeSchema.safeParse(value);

  return parsed.success ? parsed.data : DEFAULT_SITE_DATE_TIME;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify([locale, options]);
  const existing = formatters.get(key);

  if (existing) {
    return existing;
  }

  const result = new Intl.DateTimeFormat(locale, options);

  if (formatters.size >= 128) {
    formatters.clear();
  }

  formatters.set(key, result);

  return result;
}

export function formatSiteDateTime(
  value: string,
  settings: SiteDateTime,
  locale: string,
  precision: "date" | "date-time" = "date-time",
): string {
  const instant = new Date(value);

  if (!Number.isFinite(instant.getTime())) {
    return "";
  }

  const { timeZone, dateFormat, timeFormat } = settings;
  let date: string;

  if (dateFormat === "localized") {
    date = formatter(locale, { timeZone, dateStyle: "long" }).format(instant);
  } else {
    const parts = formatter("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const fields = Object.fromEntries(
      parts.map(({ type, value }) => [type, value]),
    );
    const { year, month, day } = fields;

    date = {
      "ymd-dots": `${year}.${month}.${day}.`,
      dmy: `${day}/${month}/${year}`,
      mdy: `${month}/${day}/${year}`,
      iso: `${year}-${month}-${day}`,
    }[dateFormat];
  }

  if (precision === "date") {
    return date;
  }

  const time = formatter(locale, {
    timeZone,
    hourCycle: timeFormat.startsWith("12h") ? "h12" : "h23",
    hour: timeFormat.startsWith("12h") ? "numeric" : "2-digit",
    minute: "2-digit",
    second: timeFormat.endsWith("-seconds") ? "2-digit" : undefined,
  }).format(instant);

  return `${date}, ${time}`;
}
