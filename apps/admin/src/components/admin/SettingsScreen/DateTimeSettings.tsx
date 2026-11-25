"use client";

import {
  formatSiteDateTime,
  SiteDateTimeSchema,
  SiteTimeZoneSchema,
  type SiteDateTime,
} from "@nextpress/shared/site-date-time";

import { useAdminDateLocale } from "@/lib/settings/admin-date-time";
import { Button, Input, Section, Select } from "@/ui/primitives";

import { useSettingsMessages } from "./messages";

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
  const text = useSettingsMessages();
  const validZone = SiteTimeZoneSchema.safeParse(value.timeZone).success;

  return (
    <Section title={text.dateTime} desc={text.dateTimeDescription}>
      <div className="admin-settings-field-grid">
        <Input
          id="site-time-zone"
          label={text.timeZone}
          hint={text.timeZoneHint}
          error={validZone ? undefined : text.invalidTimeZone}
          fullWidth
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
          label={text.dateFormat}
          value={value.dateFormat}
          fullWidth
          options={SiteDateTimeSchema.shape.dateFormat.options.map(
            (dateFormat) => ({
              value: dateFormat,
              label:
                dateFormat === "localized"
                  ? text.localizedDate
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
          label={text.timeFormat}
          value={value.timeFormat}
          fullWidth
          options={SiteDateTimeSchema.shape.timeFormat.options.map(
            (timeFormat) => ({
              value: timeFormat,
              label: `${timeFormat.startsWith("12h") ? 12 : 24} ${text.hour}${timeFormat.endsWith("-seconds") ? text.withSeconds : ""}`,
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
          {text.preview}{" "}
          <time dateTime={example}>
            {formatSiteDateTime(example, value, locale)}
          </time>
        </p>
      )}
      {dirty && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span role="status">{text.unsavedDateTime}</span>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {text.cancelDateTime}
          </Button>
        </div>
      )}
    </Section>
  );
}
