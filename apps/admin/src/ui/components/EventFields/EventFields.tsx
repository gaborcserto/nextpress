"use client";

import type { EventFieldsProps } from "./EventFields.types";
import { Field, FormGrid12, Input } from "@/ui/primitives";
import type { ChangeEvent } from "react";

/**
 * Event-specific fields for event pages:
 * - start/end datetime
 * - location
 * - registration URL
 */
export default function EventFields({ values, onChangeAction }: EventFieldsProps) {
  const handleChange =
    (key: "eventStart" | "eventEnd" | "eventLocation" | "registrationUrl") =>
      (e: ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        onChangeAction(key, raw ? raw : null);
      };

  return (
    <FormGrid12>
      <Field label="Start date/time" htmlFor="event-start" span={4}>
        <Input
          id="event-start"
          type="datetime-local"
          fullWidth
          value={values.eventStart ?? ""}
          onChange={handleChange("eventStart")}
        />
      </Field>

      <Field label="End date/time" htmlFor="event-end" span={4}>
        <Input
          id="event-end"
          type="datetime-local"
          fullWidth
          value={values.eventEnd ?? ""}
          onChange={handleChange("eventEnd")}
        />
      </Field>

      <Field label="Location" htmlFor="event-location" span={4}>
        <Input
          id="event-location"
          fullWidth
          placeholder="Location / venue"
          value={values.eventLocation ?? ""}
          onChange={handleChange("eventLocation")}
          clearable
        />
      </Field>

      <Field label="Registration URL" htmlFor="event-registration-url" span={12}>
        <Input
          id="event-registration-url"
          type="url"
          fullWidth
          placeholder="https://example.com/register"
          value={values.registrationUrl ?? ""}
          onChange={handleChange("registrationUrl")}
          clearable
        />
      </Field>
    </FormGrid12>
  );
}
