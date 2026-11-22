"use client";

import { useContext, useId, useRef, useState } from "react";
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaSortDown,
  FaSortUp,
} from "react-icons/fa";

import {
  AdminDateTimeContext,
  useAdminDateLocale,
} from "@/lib/settings/admin-date-time";
import { Button } from "@/ui/primitives/Buttons/Buttons";
import Input from "@/ui/primitives/Input/Input";

import { pickerMessages } from "./messages";
import {
  publicationWallTime,
  resolvePublicationTime,
} from "./publication-time";
import styles from "./PublicationDatePicker.module.css";

type PickerMode = "calendar" | "time" | null;

function localDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 12));
}

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function parseDate(value: string, locale: string) {
  const input = value.trim();
  const yearFirst = /^(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})\.?$/.exec(
    input,
  );
  const monthFirst =
    locale === "en-US" && /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  const values =
    yearFirst?.slice(1) ??
    (monthFirst ? [monthFirst[3], monthFirst[1], monthFirst[2]] : null);

  if (!values) {
    return null;
  }

  const [year, month, day] = values.map(Number);
  const candidate = localDate(year, month - 1, day);

  if (
    year < 1000 ||
    year > 9999 ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
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
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toLocalParts(value: string | null, timeZone: string) {
  if (!value) {
    return null;
  }

  const local = publicationWallTime(value, timeZone);

  return {
    date: localDate(local.year, local.month - 1, local.day),
    dateKey: local.toPlainDate().toString(),
    time: local.toPlainTime().toString({ smallestUnit: "minute" }),
  };
}

function PublicationDatePickerFields({
  id,
  value,
  locale,
  timeZone,
  disabled,
  onChange,
  onValidityChange,
}: {
  id: string;
  value: string | null;
  locale: string;
  timeZone: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timeTriggerRef = useRef<HTMLButtonElement>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const parts = toLocalParts(value, timeZone);
  const text = pickerMessages[locale === "hu" ? "hu" : "en"];
  const [occurrences, setOccurrences] = useState<
    ReturnType<typeof resolvePublicationTime>
  >([]);
  const dateInput = useRef<HTMLInputElement>(null);
  const timeInput = useRef<HTMLInputElement>(null);
  const [previousValue, setPreviousValue] = useState(value);
  const [dateText, setDateText] = useState(() =>
    parts ? formatDate(parts.date, locale) : "",
  );
  const [timeText, setTimeText] = useState(() => parts?.time ?? "");
  const [draftTime, setDraftTime] = useState(() => parts?.time ?? "00:00");
  const [dateError, setDateError] = useState("");
  const [timeError, setTimeError] = useState("");
  const [mode, setMode] = useState<PickerMode>(null);
  const todayParts = toLocalParts(new Date().toISOString(), timeZone);
  const [cursor, setCursor] = useState(
    () => parts?.date ?? todayParts?.date ?? new Date(),
  );

  if (value !== previousValue) {
    setPreviousValue(value);
    setDateText(parts ? formatDate(parts.date, locale) : "");
    setTimeText(parts?.time ?? "");
    setDateError("");
    setTimeError("");
    setOccurrences([]);
  }

  const days = Array.from({ length: 42 }, (_, index) => {
    const first = localDate(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1);
    const offset = (first.getUTCDay() + 6) % 7;

    return localDate(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth(),
      index - offset + 1,
    );
  });
  const labels = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
  });
  const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    }).format(localDate(2024, 0, index + 1)),
  );
  const daySteps: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  };
  const today = todayParts?.dateKey;

  function openPopover(nextMode: Exclude<PickerMode, null>) {
    const dialog = dialogRef.current;
    const trigger =
      nextMode === "calendar" ? triggerRef.current : timeTriggerRef.current;

    if (!dialog || !trigger) {
      return;
    }

    const selected = parts?.dateKey || today;
    setCursor(parts?.date ?? todayParts?.date ?? new Date());
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
      const besideTrigger = openBelow ? below : above;
      const overlayTrigger = besideTrigger < 160;
      const availableHeight = overlayTrigger
        ? viewportHeight - gap * 2
        : besideTrigger;

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
      dialog.style.top = `${overlayTrigger ? gap : top}px`;
      dialog.style.maxHeight = `${availableHeight}px`;

      if (nextMode === "calendar") {
        if (selected) {
          dayRefs.current.get(selected)?.focus();
        }
      } else {
        dialog.querySelector<HTMLInputElement>("input")?.focus();
      }
    });
  }

  function commit(dateValue: string, timeValue: string) {
    onValidityChange?.(false);
    const date = parseDate(dateValue, locale);
    const time = parseTime(timeValue);

    if (!date) {
      setDateError(text.invalidDate);
      dateInput.current?.setCustomValidity(text.invalidDate);

      return false;
    }

    if (!time) {
      setTimeError(text.invalidTime);
      timeInput.current?.setCustomValidity(text.invalidTime);

      return false;
    }

    const day = localDate(date.year, date.month - 1, date.day);
    const clock = `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}`;
    const key = dateKey(day);

    setDateText(formatDate(day, locale));
    setTimeText(clock);
    setDateError("");
    dateInput.current?.setCustomValidity("");

    // A visit to an existing minute preserves both its occurrence and its precision.
    if (parts?.dateKey === key && parts.time === clock) {
      clearTimeError();
      onValidityChange?.(true);

      return true;
    }

    const matches = resolvePublicationTime(`${key}T${clock}`, timeZone);

    if (matches.length !== 1) {
      const message = matches.length ? text.overlap : text.gap;
      setOccurrences(matches);
      setTimeError(message);
      timeInput.current?.setCustomValidity(message);

      return false;
    }

    clearTimeError();
    onValidityChange?.(true);
    onChange(matches[0].instant);

    return true;
  }

  function clearTimeError() {
    setOccurrences([]);
    setTimeError("");
    timeInput.current?.setCustomValidity("");
  }

  function clearDate() {
    onValidityChange?.(true);
    onChange(null);
    setDateText("");
    setTimeText("");
    setDateError("");
    dateInput.current?.setCustomValidity("");
    clearTimeError();
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
        ? localDate(parsedDate.year, parsedDate.month - 1, parsedDate.day)
        : null);

    if (!date) {
      setDateError(text.dateFirst);

      return;
    }

    const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    commit(formatDate(date, locale), value);
    closePopover(false);
    timeInput.current?.focus();
  }

  return (
    <div className={styles.picker}>
      <p id={`${id}-zone`}>
        {text.zone} {timeZone}
      </p>
      <div className={styles.fields}>
        <div className={styles.field}>
          <Input
            ref={dateInput}
            id={`${id}-date`}
            type="text"
            inputMode="numeric"
            maxLength={16}
            autoComplete="off"
            aria-label={text.date}
            value={dateText}
            aria-invalid={Boolean(dateError)}
            aria-describedby={dateError ? `${id}-date-error` : `${id}-zone`}
            disabled={disabled}
            fullWidth
            onChange={(event) => {
              setDateText(event.target.value);
              setDateError("");
              onValidityChange?.(false);
              event.currentTarget.setCustomValidity(text.applyDate);
              setOccurrences([]);
            }}
            onBlur={() => {
              if (dateText.trim()) {
                commit(dateText, timeText || parts?.time || "00:00");
              } else {
                clearDate();
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
            aria-label={text.calendar}
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
            ref={timeInput}
            id={`${id}-time`}
            type="text"
            inputMode="numeric"
            maxLength={16}
            autoComplete="off"
            aria-label={text.time}
            placeholder="HH:MM"
            value={timeText}
            aria-invalid={Boolean(timeError)}
            aria-describedby={timeError ? `${id}-time-error` : `${id}-zone`}
            disabled={disabled}
            onChange={(event) => {
              setTimeText(event.target.value);
              setTimeError("");
              onValidityChange?.(false);
              event.currentTarget.setCustomValidity(text.applyTime);
              setOccurrences([]);
            }}
            onBlur={() => {
              if (dateText || timeText) {
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
            aria-label={text.timeSelector}
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
      {occurrences.length > 1 && (
        <div role="group" aria-label={text.overlap}>
          {occurrences.map((occurrence, index) => (
            <Button
              key={occurrence.instant}
              type="button"
              size="sm"
              onClick={() => {
                clearTimeError();
                onValidityChange?.(true);
                onChange(occurrence.instant);
              }}
            >
              {index === 0 ? text.first : text.second} (UTC{occurrence.offset})
            </Button>
          ))}
        </div>
      )}
      <dialog
        ref={dialogRef}
        id={dialogId}
        className={styles.dialog}
        aria-label={mode === "time" ? text.chooseTime : text.chooseDate}
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
                aria-label={text.previous}
                onClick={() =>
                  setCursor(
                    localDate(
                      cursor.getUTCFullYear(),
                      cursor.getUTCMonth() - 1,
                      1,
                    ),
                  )
                }
              >
                <FaChevronLeft />
              </button>
              <strong aria-live="polite">{labels.format(cursor)}</strong>
              <button
                className={styles.iconControl}
                type="button"
                aria-label={text.next}
                onClick={() =>
                  setCursor(
                    localDate(
                      cursor.getUTCFullYear(),
                      cursor.getUTCMonth() + 1,
                      1,
                    ),
                  )
                }
              >
                <FaChevronRight />
              </button>
            </header>
            <div
              className={styles.grid}
              role="group"
              aria-label={text.chooseDay}
            >
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
                  data-outside={day.getUTCMonth() !== cursor.getUTCMonth()}
                  data-today={dateKey(day) === today}
                  aria-pressed={parts?.dateKey === dateKey(day)}
                  aria-label={new Intl.DateTimeFormat(locale, {
                    dateStyle: "full",
                    timeZone: "UTC",
                  }).format(day)}
                  tabIndex={dateKey(day) === (parts?.dateKey || today) ? 0 : -1}
                  onKeyDown={(event) => {
                    const delta = daySteps[event.key];

                    if (delta === undefined) {
                      return;
                    }

                    event.preventDefault();
                    const next = localDate(
                      day.getUTCFullYear(),
                      day.getUTCMonth(),
                      day.getUTCDate() + delta,
                    );
                    setCursor(next);
                    requestAnimationFrame(() =>
                      dayRefs.current.get(dateKey(next))?.focus(),
                    );
                  }}
                  onClick={() => {
                    const nextDate = formatDate(day, locale);

                    commit(nextDate, timeText || parts?.time || "00:00");
                    closePopover();
                  }}
                >
                  {new Intl.DateTimeFormat(locale, {
                    day: "numeric",
                    timeZone: "UTC",
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
                  clearDate();
                  closePopover();
                }}
              >
                {text.clear}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                color="neutral"
                onClick={() => closePopover()}
              >
                {text.cancel}
              </Button>
            </footer>
          </>
        ) : (
          <>
            <header className={styles.timeHeader}>
              <strong>{text.selectTime}</strong>
            </header>
            <div className={styles.timePicker}>
              {(["Hour", "Minute"] as const).map((label) => {
                const hourField = label === "Hour";
                const fieldLabel = hourField ? text.hour : text.minute;
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
                      {fieldLabel}
                    </label>
                    <span className={styles.stepper}>
                      <button
                        className={styles.iconControl}
                        type="button"
                        aria-label={`${text.increase} ${fieldLabel}`}
                        onClick={() => step(1)}
                      >
                        <FaSortUp aria-hidden="true" />
                      </button>
                      <input
                        aria-label={fieldLabel}
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
                        aria-label={`${text.decrease} ${fieldLabel}`}
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
                {text.apply}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                color="neutral"
                onClick={() => closePopover()}
              >
                {text.cancel}
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
  onValidityChange?: (valid: boolean) => void;
}) {
  const locale = useAdminDateLocale();
  const settings = useContext(AdminDateTimeContext);

  if (!settings) {
    return (
      <p role="alert">
        {pickerMessages[locale === "hu" ? "hu" : "en"].unavailable}
      </p>
    );
  }

  return (
    <PublicationDatePickerFields
      {...props}
      key={JSON.stringify([settings.timeZone, locale])}
      locale={locale}
      timeZone={settings.timeZone}
    />
  );
}
