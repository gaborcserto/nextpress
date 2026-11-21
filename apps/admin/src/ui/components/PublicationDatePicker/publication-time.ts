import { Temporal } from "temporal-polyfill";

export function resolvePublicationTime(wallTime: string, timeZone: string) {
  const local = Temporal.PlainDateTime.from(wallTime);
  const earlier = local.toZonedDateTime(timeZone, {
    disambiguation: "earlier",
  });
  const later = local.toZonedDateTime(timeZone, { disambiguation: "later" });

  if (!earlier.toPlainDateTime().equals(local)) {
    return [];
  }

  const matches = earlier.equals(later) ? [earlier] : [earlier, later];

  return matches.map((value) => ({
    instant: new Date(value.epochMilliseconds).toISOString(),
    offset: value.offset,
  }));
}

export function publicationWallTime(value: string, timeZone: string) {
  return Temporal.Instant.from(value)
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime();
}
