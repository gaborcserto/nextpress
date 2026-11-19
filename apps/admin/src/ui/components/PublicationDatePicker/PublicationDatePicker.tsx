"use client";

import { useId, useRef, useState } from "react";
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaSortDown,
  FaSortUp,
} from "react-icons/fa";

import { Button } from "@/ui/primitives/Buttons/Buttons";
import Input from "@/ui/primitives/Input/Input";

import styles from "./PublicationDatePicker.module.css";

type PickerMode = "calendar" | "time" | null;

function localDate(year: number, month: number, day: number) {
  return new Date(year, month, day, 12);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string, locale: string) {
  const values = value.match(/\d+/g)?.map(Number);

  if (!values || values.length !== 3) {
    return null;
  }

  const [year, month, day] =
    values[0] > 31
      ? values
      : locale.toLowerCase().startsWith("en-us")
        ? [values[2], values[0], values[1]]
        : [values[2], values[1], values[0]];
  const candidate = new Date(year, month - 1, day, 12);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours < 24 && minutes < 60 ? { hours, minutes } : null;
}

function formatDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toLocalParts(value: string | null) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    date,
    dateKey: dateKey(date),
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
}

function PublicationDatePickerFields({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: string | null;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timeTriggerRef = useRef<HTMLButtonElement>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const locale = document.documentElement.lang || navigator.language || "en-US";
  const parts = toLocalParts(value);
  const [dateText, setDateText] = useState(() =>
    parts ? formatDate(parts.date, locale) : "",
  );
  const [timeText, setTimeText] = useState(() => parts?.time ?? "");
  const [draftTime, setDraftTime] = useState(() => parts?.time ?? "00:00");
  const [dateError, setDateError] = useState("");
  const [timeError, setTimeError] = useState("");
  const [mode, setMode] = useState<PickerMode>(null);
  const [cursor, setCursor] = useState(() => (parts ? parts.date : new Date()));
  const days = Array.from({ length: 42 }, (_, index) => {
    const first = localDate(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;

    return localDate(
      cursor.getFullYear(),
      cursor.getMonth(),
      index - offset + 1,
    );
  });
  const labels = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
  });
  const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
      localDate(2024, 0, index + 1),
    ),
  );
  const daySteps: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  };
  const today = dateKey(new Date());

  function openPopover(nextMode: Exclude<PickerMode, null>) {
    const dialog = dialogRef.current;
    const trigger =
      nextMode === "calendar" ? triggerRef.current : timeTriggerRef.current;

    if (!dialog || !trigger) {
      return;
    }

    const selected = parts?.dateKey || today;
    setCursor(parts?.date ?? new Date());
    setMode(nextMode);

    if (nextMode === "time") {
      setDraftTime(parts?.time ?? "00:00");
    }

    dialog.showModal();

    requestAnimationFrame(() => {
      const triggerRect = trigger.getBoundingClientRect();
      const dialogRect = dialog.getBoundingClientRect();
      const gap = 8;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const width = Math.min(dialogRect.width, viewportWidth - gap * 2);
      const below = viewportHeight - triggerRect.bottom - gap;
      const above = triggerRect.top - gap;
      const openBelow = below >= Math.min(dialogRect.height, above);
      const availableHeight = Math.max(160, openBelow ? below : above);
      const left = Math.min(
        Math.max(gap, triggerRect.right - width),
        viewportWidth - width - gap,
      );
      const top = openBelow
        ? triggerRect.bottom + gap
        : Math.max(
            gap,
            triggerRect.top -
              Math.min(dialogRect.height, availableHeight) -
              gap,
          );

      dialog.style.left = `${left}px`;
      dialog.style.top = `${top}px`;
      dialog.style.maxHeight = `${availableHeight}px`;

      if (nextMode === "calendar") {
        dayRefs.current.get(selected)?.focus();
      } else {
        dialog.querySelector<HTMLInputElement>("input")?.focus();
      }
    });
  }

  function commit(dateValue: string, timeValue: string) {
    const date = parseDate(dateValue, locale);
    const time = parseTime(timeValue);

    if (!date) {
      setDateError("Enter a valid date.");

      return false;
    }

    if (!time) {
      setTimeError("Enter a time from 00:00 to 23:59.");

      return false;
    }

    const result = new Date(
      date.year,
      date.month - 1,
      date.day,
      time.hours,
      time.minutes,
      parts?.date.getSeconds() ?? 0,
      parts?.date.getMilliseconds() ?? 0,
    );

    if (
      result.getFullYear() !== date.year ||
      result.getMonth() !== date.month - 1 ||
      result.getDate() !== date.day ||
      result.getHours() !== time.hours ||
      result.getMinutes() !== time.minutes
    ) {
      setTimeError(
        "This local time does not exist because of a daylight-saving change.",
      );

      return false;
    }

    setDateError("");
    setTimeError("");
    onChange(result.toISOString());
    setDateText(
      formatDate(new Date(date.year, date.month - 1, date.day, 12), locale),
    );
    setTimeText(
      `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}`,
    );

    return true;
  }

  function closePopover(restoreFocus = true) {
    dialogRef.current?.close();
    setMode(null);

    if (restoreFocus) {
      (mode === "time" ? timeTriggerRef.current : triggerRef.current)?.focus();
    }
  }

  function selectTime(hours: number, minutes: number) {
    const parsedDate = parseDate(dateText, locale);
    const date =
      parts?.date ??
      (parsedDate
        ? new Date(parsedDate.year, parsedDate.month - 1, parsedDate.day, 12)
        : null);

    if (!date) {
      setDateError("Enter a valid date first.");

      return;
    }

    const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    if (commit(formatDate(date, locale), value)) {
      setTimeText(value);
      closePopover(false);
      document.getElementById(`${id}-time`)?.focus();
    }
  }

  return (
    <div className={styles.picker}>
      <div className={styles.fields}>
        <div className={styles.field}>
          <Input
            id={`${id}-date`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label="Publish date"
            value={dateText}
            aria-invalid={Boolean(dateError)}
            aria-describedby={dateError ? `${id}-date-error` : undefined}
            disabled={disabled}
            fullWidth
            onChange={(event) => {
              setDateText(event.target.value);
              setDateError("");
            }}
            onBlur={() => {
              if (dateText.trim()) {
                commit(dateText, timeText || parts?.time || "00:00");
              } else {
                onChange(null);
                setTimeText("");
                setDateError("");
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit(dateText, timeText || parts?.time || "00:00");
              }
            }}
          />
          <button
            ref={triggerRef}
            type="button"
            className={styles.iconButton}
            aria-label="Open calendar"
            aria-haspopup="dialog"
            aria-controls={dialogId}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => openPopover("calendar")}
          >
            <FaCalendarAlt aria-hidden="true" />
          </button>
          {dateError && (
            <span id={`${id}-date-error`} className={styles.error} role="alert">
              {dateError}
            </span>
          )}
        </div>
        <div className={styles.field}>
          <Input
            id={`${id}-time`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label="Publish time"
            placeholder="HH:MM"
            value={timeText}
            aria-invalid={Boolean(timeError)}
            aria-describedby={timeError ? `${id}-time-error` : undefined}
            disabled={disabled}
            onChange={(event) => {
              setTimeText(event.target.value);
              setTimeError("");
            }}
            onBlur={() => {
              if (timeText.trim()) {
                commit(dateText, timeText);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit(dateText, timeText);
              }
            }}
          />
          <button
            ref={timeTriggerRef}
            type="button"
            className={styles.iconButton}
            aria-label="Open time selector"
            aria-haspopup="dialog"
            aria-controls={dialogId}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => openPopover("time")}
          >
            <FaClock aria-hidden="true" />
          </button>
          {timeError && (
            <span id={`${id}-time-error`} className={styles.error} role="alert">
              {timeError}
            </span>
          )}
        </div>
      </div>
      <dialog
        ref={dialogRef}
        id={dialogId}
        className={styles.dialog}
        aria-label={
          mode === "time" ? "Choose publish time" : "Choose publish date"
        }
        onClose={() => setMode(null)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closePopover();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closePopover();
          }
        }}
      >
        {mode === "calendar" ? (
          <>
            <header className={styles.header}>
              <button
                className={styles.iconControl}
                type="button"
                aria-label="Previous month"
                onClick={() =>
                  setCursor(
                    localDate(cursor.getFullYear(), cursor.getMonth() - 1, 1),
                  )
                }
              >
                <FaChevronLeft />
              </button>
              <strong aria-live="polite">{labels.format(cursor)}</strong>
              <button
                className={styles.iconControl}
                type="button"
                aria-label="Next month"
                onClick={() =>
                  setCursor(
                    localDate(cursor.getFullYear(), cursor.getMonth() + 1, 1),
                  )
                }
              >
                <FaChevronRight />
              </button>
            </header>
            <div className={styles.grid} role="group" aria-label="Choose day">
              {weekdayLabels.map((label, index) => (
                <span
                  className={styles.weekday}
                  key={`${label}-${index}`}
                  aria-hidden="true"
                >
                  {label}
                </span>
              ))}
              {days.map((day) => (
                <button
                  key={dateKey(day)}
                  ref={(node) => {
                    if (node) {
                      dayRefs.current.set(dateKey(day), node);
                    } else {
                      dayRefs.current.delete(dateKey(day));
                    }
                  }}
                  type="button"
                  data-outside={day.getMonth() !== cursor.getMonth()}
                  data-today={dateKey(day) === today}
                  aria-pressed={parts?.dateKey === dateKey(day)}
                  aria-label={new Intl.DateTimeFormat(locale, {
                    dateStyle: "full",
                  }).format(day)}
                  tabIndex={dateKey(day) === (parts?.dateKey || today) ? 0 : -1}
                  onKeyDown={(event) => {
                    const delta = daySteps[event.key];

                    if (delta === undefined) {
                      return;
                    }

                    event.preventDefault();
                    const next = localDate(
                      day.getFullYear(),
                      day.getMonth(),
                      day.getDate() + delta,
                    );
                    setCursor(next);
                    requestAnimationFrame(() =>
                      dayRefs.current.get(dateKey(next))?.focus(),
                    );
                  }}
                  onClick={() => {
                    const nextDate = formatDate(day, locale);

                    if (commit(nextDate, timeText || parts?.time || "00:00")) {
                      setDateText(nextDate);
                      closePopover();
                    }
                  }}
                >
                  {new Intl.DateTimeFormat(undefined, {
                    day: "numeric",
                  }).format(day)}
                </button>
              ))}
            </div>
            <footer className={styles.footer}>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                color="neutral"
                onClick={() => {
                  onChange(null);
                  setDateText("");
                  setDateError("");
                  closePopover();
                }}
              >
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                color="neutral"
                onClick={() => closePopover()}
              >
                Cancel
              </Button>
            </footer>
          </>
        ) : (
          <>
            <header className={styles.timeHeader}>
              <strong>Select time</strong>
            </header>
            <div className={styles.timePicker}>
              {(["Hour", "Minute"] as const).map((label) => {
                const hourField = label === "Hour";
                const time = parseTime(draftTime) ?? { hours: 0, minutes: 0 };
                const current = hourField ? time.hours : time.minutes;
                const limit = hourField ? 24 : 60;

                const step = (amount: number) => {
                  const next = (current + amount + limit) % limit;
                  const hours = hourField ? next : time.hours;
                  const minutes = hourField ? time.minutes : next;
                  setDraftTime(
                    `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
                  );
                };

                return (
                  <div key={label}>
                    <label htmlFor={`${id}-${label.toLowerCase()}`}>
                      {label}
                    </label>
                    <span className={styles.stepper}>
                      <button
                        className={styles.iconControl}
                        type="button"
                        aria-label={`Increase ${label.toLowerCase()}`}
                        onClick={() => step(1)}
                      >
                        <FaSortUp aria-hidden="true" />
                      </button>
                      <input
                        aria-label={label}
                        id={`${id}-${label.toLowerCase()}`}
                        type="text"
                        inputMode="numeric"
                        value={String(current).padStart(2, "0")}
                        onChange={(event) => {
                          if (
                            /^\d{0,2}$/.test(event.target.value) &&
                            (event.target.value === "" ||
                              Number(event.target.value) < limit)
                          ) {
                            const next = Number(event.target.value);
                            const hours = hourField ? next : time.hours;
                            const minutes = hourField ? time.minutes : next;
                            setDraftTime(
                              `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
                            );
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === "ArrowUp" ||
                            event.key === "ArrowDown"
                          ) {
                            event.preventDefault();
                            step(event.key === "ArrowUp" ? 1 : -1);
                          }
                        }}
                      />
                      <button
                        className={styles.iconControl}
                        type="button"
                        aria-label={`Decrease ${label.toLowerCase()}`}
                        onClick={() => step(-1)}
                      >
                        <FaSortDown aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
            <footer className={styles.footer}>
              <Button
                type="button"
                size="sm"
                color="primary"
                onClick={() =>
                  selectTime(
                    parseTime(draftTime)?.hours ?? 0,
                    parseTime(draftTime)?.minutes ?? 0,
                  )
                }
              >
                Apply
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                color="neutral"
                onClick={() => closePopover()}
              >
                Cancel
              </Button>
            </footer>
          </>
        )}
      </dialog>
    </div>
  );
}

export default function PublicationDatePicker(props: {
  id: string;
  value: string | null;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  return (
    <PublicationDatePickerFields key={props.value ?? "empty"} {...props} />
  );
}
