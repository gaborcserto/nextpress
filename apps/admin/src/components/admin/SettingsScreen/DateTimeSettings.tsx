"use client";

import {
  formatSiteDateTime,
  SiteDateTimeSchema,
  SiteTimeZoneSchema,
  type SiteDateTime,
} from "@nextpress/shared/site-date-time";

import { useAdminDateLocale } from "@/lib/settings/admin-date-time";
import { Button, Input, Section, Select } from "@/ui/primitives";

const example = "2026-11-21T14:54:23.000Z";

export function DateTimeSettings({
  value,
  timeZones,
  dirty,
  onChange,
  onCancel,
}: {
  value: SiteDateTime;
  timeZones: readonly string[];
  dirty: boolean;
  onChange: (value: SiteDateTime) => void;
  onCancel: () => void;
}) {
  const locale = useAdminDateLocale();
  const hu = locale === "hu";
  const validZone = SiteTimeZoneSchema.safeParse(value.timeZone).success;

  return (
    <Section
      title={hu ? "Dátum és idő" : "Date and time"}
      desc={
        hu
          ? "Az időzóna a megjelenítést és az új ütemezéseket szabályozza. A mentett időpontok változatlanok maradnak."
          : "The timezone controls display and new scheduling input. Saved timestamps keep their original instants."
      }
    >
      <div className="admin-settings-field-grid">
        <Input
          id="site-time-zone"
          label={hu ? "Webhely időzónája" : "Site timezone"}
          hint={
            hu
              ? "Keressen város vagy IANA-azonosító alapján."
              : "Search by city or enter an IANA identifier."
          }
          error={
            validZone
              ? undefined
              : hu
                ? "Adjon meg érvényes IANA-időzónát."
                : "Enter a valid IANA timezone."
          }
          value={value.timeZone}
          list="site-time-zone-options"
          required
          maxLength={100}
          onChange={(event) =>
            onChange({ ...value, timeZone: event.target.value })
          }
        />
        <datalist id="site-time-zone-options">
          {timeZones.map((zone) => (
            <option key={zone} value={zone} label={zone.replaceAll("_", " ")} />
          ))}
        </datalist>
        <Select
          label={hu ? "Dátumformátum" : "Date format"}
          value={value.dateFormat}
          fullWidth
          options={SiteDateTimeSchema.shape.dateFormat.options.map(
            (dateFormat) => ({
              value: dateFormat,
              label:
                dateFormat === "localized"
                  ? hu
                    ? "A felület nyelve szerint"
                    : "Localized long date"
                  : formatSiteDateTime(
                      example,
                      { ...value, timeZone: "UTC", dateFormat },
                      locale,
                      "date",
                    ),
            }),
          )}
          onChangeAction={(dateFormat) =>
            onChange({
              ...value,
              dateFormat: SiteDateTimeSchema.shape.dateFormat.parse(dateFormat),
            })
          }
        />
        <Select
          label={hu ? "Időformátum" : "Time format"}
          value={value.timeFormat}
          fullWidth
          options={SiteDateTimeSchema.shape.timeFormat.options.map(
            (timeFormat) => ({
              value: timeFormat,
              label: `${timeFormat.startsWith("12h") ? 12 : 24} ${hu ? "órás" : "hour"}${timeFormat.endsWith("-seconds") ? (hu ? ", másodpercekkel" : ", with seconds") : ""}`,
            }),
          )}
          onChangeAction={(timeFormat) =>
            onChange({
              ...value,
              timeFormat: SiteDateTimeSchema.shape.timeFormat.parse(timeFormat),
            })
          }
        />
      </div>
      {validZone && (
        <p
          aria-live="polite"
          className="mt-4 rounded-(--radius-control) bg-(--surface-rail) p-3 text-sm wrap-anywhere"
        >
          {hu ? "Előnézet" : "Preview"}{" "}
          <time dateTime={example}>
            {formatSiteDateTime(example, value, locale)}
          </time>
        </p>
      )}
      {dirty && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span role="status">
            {hu
              ? "Nem mentett dátum- és időbeállítások"
              : "Unsaved date and time changes"}
          </span>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {hu ? "Mégse" : "Cancel date and time changes"}
          </Button>
        </div>
      )}
    </Section>
  );
}
