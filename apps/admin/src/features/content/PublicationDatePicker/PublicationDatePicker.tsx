"use client";

import { useContext, useEffect, useId, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

import { useAdminLocale } from "@/lib/i18n/admin-locale";
import {
  AdminDateTimeContext,
  useAdminDateLocale,
} from "@/lib/settings/admin-date-time";
import { AdminButton, AdminToggleButton } from "@/ui/primitives/Buttons";
import Input from "@/ui/primitives/Input/Input";

import { pickerMessages } from "./messages";
import {
  publicationWallTime,
  resolvePublicationTime,
} from "./publication-time";
import styles from "./PublicationDatePicker.module.css";

import type { SiteDateTime } from "@nextpress/shared/site-date-time";

type PickerMode = "calendar" | null;
type CalendarView = "day" | "month" | "year";
type ClockTime = { hours: number; minutes: number };

function localDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 12));
}

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function parseDate(
  value: string,
  locale: string,
  format: SiteDateTime["dateFormat"],
) {
  const input = value.trim();
  const yearFirst = /^(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})\.?$/.exec(
    input,
  );
  const monthFirst =
    locale === "en-US" && /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  const separated = /^([\d]{1,4})[./-]([\d]{1,2})[./-]([\d]{1,4})\.?$/.exec(
    input,
  );
  const values =
    yearFirst?.slice(1) ??
    (monthFirst
      ? [monthFirst[3], monthFirst[1], monthFirst[2]]
      : separated && format === "dmy"
        ? [separated[3], separated[2], separated[1]]
        : separated && format === "mdy"
          ? [separated[3], separated[1], separated[2]]
          : null);

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

function parseClock(value: string): ClockTime | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours < 24 && minutes < 60 ? { hours, minutes } : null;
}

function periodLabel(hour: 9 | 21, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    hour: "numeric",
    hourCycle: "h12",
  })
    .formatToParts(new Date(Date.UTC(2020, 0, 1, hour)))
    .find(({ type }) => type === "dayPeriod")?.value;
}

function formatTime(time: ClockTime, locale: string, format: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    hourCycle: format.startsWith("12h") ? "h12" : "h23",
    hour: format.startsWith("12h") ? "numeric" : "2-digit",
    minute: "2-digit",
  }).format(new Date(Date.UTC(2020, 0, 1, time.hours, time.minutes)));
}

function clockValue(time: ClockTime) {
  return [
    String(time.hours).padStart(2, "0"),
    String(time.minutes).padStart(2, "0"),
  ].join(":");
}

function parseTime(value: string, locale: string, format: string) {
  const input = value.trim();
  const match = /(\d{1,2}):(\d{2})/.exec(input);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period =
    `${input.slice(0, match.index)} ${input.slice(match.index + match[0].length)}`
      .trim()
      .toLocaleLowerCase(locale);

  if (format.startsWith("12h") && period) {
    const morning = periodLabel(9, locale)?.toLocaleLowerCase(locale);
    const evening = periodLabel(21, locale)?.toLocaleLowerCase(locale);

    if (minutes >= 60 || hours < 1 || hours > 12) {
      return null;
    }

    if (period === morning) {
      return { hours: hours % 12, minutes };
    }

    if (period === evening) {
      return { hours: (hours % 12) + 12, minutes };
    }

    return null;
  }

  return hours < 24 && minutes < 60 ? { hours, minutes } : null;
}

function formatDate(
  date: Date,
  locale: string,
  format: SiteDateTime["dateFormat"],
) {
  const { year, month, day } = {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, "0"),
    day: String(date.getUTCDate()).padStart(2, "0"),
  };

  if (format === "ymd-dots") {
    return `${year}.${month}.${day}.`;
  }

  if (format === "dmy") {
    return `${day}/${month}/${year}`;
  }

  if (format === "mdy") {
    return `${month}/${day}/${year}`;
  }

  if (format === "iso") {
    return `${year}-${month}-${day}`;
  }

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
  dateFormat,
  timeFormat,
  disabled,
  onChange,
  onValidityChange,
}: {
  id: string;
  value: string | null;
  locale: string;
  timeZone: string;
  dateFormat: SiteDateTime["dateFormat"];
  timeFormat: SiteDateTime["timeFormat"];
  disabled?: boolean;
  onChange: (value: string | null) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const monthViewButtonRef = useRef<HTMLButtonElement>(null);
  const yearViewButtonRef = useRef<HTMLButtonElement>(null);
  const parts = toLocalParts(value, timeZone);
  const text = pickerMessages[useAdminLocale()];
  const [occurrences, setOccurrences] = useState<
    ReturnType<typeof resolvePublicationTime>
  >([]);
  const dateInput = useRef<HTMLInputElement>(null);
  const timeInput = useRef<HTMLInputElement>(null);
  const [previousValue, setPreviousValue] = useState(value);
  const [dateText, setDateText] = useState(() =>
    parts ? formatDate(parts.date, locale, dateFormat) : "",
  );
  const [timeText, setTimeText] = useState(() =>
    parts?.time
      ? formatTime(
          parseClock(parts.time) ?? { hours: 0, minutes: 0 },
          locale,
          timeFormat,
        )
      : "",
  );
  const [draftTime, setDraftTime] = useState(() => parts?.time ?? "00:00");
  const [dateError, setDateError] = useState("");
  const [timeError, setTimeError] = useState("");
  const [mode, setMode] = useState<PickerMode>(null);
  const todayParts = toLocalParts(new Date().toISOString(), timeZone);
  const [cursor, setCursor] = useState(
    () => parts?.date ?? todayParts?.date ?? new Date(),
  );
  const [view, setView] = useState<CalendarView>("day");
  const [viewHistory, setViewHistory] = useState<
    { view: CalendarView; focus: "month" | "year" }[]
  >([]);
  const focusAfterViewRef = useRef<"month" | "year" | null>(null);
  const [yearRangeStart, setYearRangeStart] = useState(() => {
    const year =
      parts?.date.getUTCFullYear() ??
      todayParts?.date.getUTCFullYear() ??
      new Date().getUTCFullYear();

    return Math.floor(year / 12) * 12;
  });

  if (value !== previousValue) {
    setPreviousValue(value);
    setDateText(parts ? formatDate(parts.date, locale, dateFormat) : "");
    setTimeText(
      parts?.time
        ? formatTime(
            parseClock(parts.time) ?? { hours: 0, minutes: 0 },
            locale,
            timeFormat,
          )
        : "",
    );
    setDateError("");
    setTimeError("");
    setOccurrences([]);
  }

  useEffect(() => {
    if (!focusAfterViewRef.current) {
      return;
    }

    const target =
      focusAfterViewRef.current === "year"
        ? yearViewButtonRef
        : monthViewButtonRef;
    target.current?.focus();
    focusAfterViewRef.current = null;
  }, [view]);

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
  const draftDate = parseDate(dateText, locale, dateFormat);
  const draftDateKey = draftDate
    ? dateKey(localDate(draftDate.year, draftDate.month - 1, draftDate.day))
    : null;

  function openPopover() {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;

    if (!dialog || !trigger) {
      return;
    }

    const selected = parts?.dateKey || today;
    setCursor(parts?.date ?? todayParts?.date ?? new Date());
    setMode("calendar");
    setView("day");
    setViewHistory([]);

    const parsedTime = parseTime(timeText, locale, timeFormat);
    const selectedTime = parsedTime ??
      parseClock(parts?.time ?? "") ?? { hours: 0, minutes: 0 };
    setDraftTime(clockValue(selectedTime));

    const mobile =
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(max-width: 48rem)").matches;

    if (mobile) {
      dialog.showModal();
    } else {
      dialog.showPopover();
    }

    requestAnimationFrame(() => {
      const triggerRect = trigger.getBoundingClientRect();
      const dialogRect = dialog.getBoundingClientRect();
      const gap = 8;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const width = Math.min(dialogRect.width, viewportWidth - gap * 2);
      const below = viewportHeight - triggerRect.bottom - gap;
      const above = triggerRect.top - gap;
      const openBelow =
        below >= Math.min(dialogRect.height, 420) || below >= above;
      const besideTrigger = openBelow ? below : above;
      const overlayTrigger = mobile || besideTrigger < 160;
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

      if (selected) {
        dayRefs.current.get(selected)?.focus();
      }
    });
  }

  function commit(dateValue: string, timeValue: string) {
    onValidityChange?.(false);
    const date = parseDate(dateValue, locale, dateFormat);
    const time = parseTime(timeValue, locale, timeFormat);

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
    const clock = clockValue(time);
    const key = dateKey(day);

    setDateText(formatDate(day, locale, dateFormat));
    setTimeText(formatTime(time, locale, timeFormat));
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
    const dialog = dialogRef.current;

    if (dialog?.matches(":popover-open")) {
      dialog.hidePopover();
    } else {
      dialog?.close();
    }

    setMode(null);

    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }

  function selectCalendarDate(day: Date) {
    const selectedTime = parseClock(draftTime) ??
      parseTime(timeText, locale, timeFormat) ??
      parseClock(parts?.time ?? "") ?? { hours: 0, minutes: 0 };

    const date = formatDate(day, locale, dateFormat);
    const time = formatTime(selectedTime, locale, timeFormat);

    setCursor(day);
    commit(date, time);
  }

  function updateSelectedTime(nextTime: ClockTime) {
    const value = clockValue(nextTime);

    setDraftTime(value);

    if (parseDate(dateText, locale, dateFormat)) {
      commit(dateText, formatTime(nextTime, locale, timeFormat));
    }
  }

  function selectToday() {
    const today = todayParts?.date;

    if (today) {
      selectCalendarDate(today);
    }
  }

  const monthOptions = Array.from({ length: 12 }, (_, month) => ({
    label: new Intl.DateTimeFormat(locale, {
      month: "short",
      timeZone: "UTC",
    }).format(localDate(2024, month, 1)),
    value: month,
  }));
  const yearOptions = Array.from(
    { length: 12 },
    (_, index) => yearRangeStart + index,
  );
  const displayedYear = cursor.getUTCFullYear();
  const displayedMonth = cursor.getUTCMonth();

  function returnFromSelection() {
    const previous = viewHistory.at(-1);
    setViewHistory((history) => history.slice(0, -1));
    setView(previous?.view ?? "day");
    focusAfterViewRef.current = previous?.focus ?? "month";
  }

  return (
    <div className={styles.picker}>
      <div className={styles.fields} ref={fieldRef}>
        <div className={styles.field}>
          <Input
            ref={(element) => {
              dateInput.current = element;
              timeInput.current = element;
            }}
            id={`${id}-datetime`}
            type="text"
            autoComplete="off"
            aria-label={`${text.date} and ${text.time}`}
            placeholder={`${formatDate(new Date(), locale, dateFormat)} ${formatTime({ hours: 13, minutes: 30 }, locale, timeFormat)}`}
            value={dateText ? `${dateText} ${timeText}` : ""}
            aria-invalid={Boolean(dateError || timeError)}
            aria-describedby={
              dateError
                ? `${id}-date-error`
                : timeError
                  ? `${id}-time-error`
                  : `${id}-zone`
            }
            disabled={disabled}
            fullWidth
            onChange={(event) => {
              const [nextDate = "", ...nextTime] = event.target.value
                .trim()
                .split(/\s+/);
              const nextClock = nextTime.join(" ");
              setDateText(nextDate);
              setTimeText(nextClock);
              setDateError("");
              setTimeError("");
              onValidityChange?.(false);
              event.currentTarget.setCustomValidity("");
              setOccurrences([]);

              if (
                parseDate(nextDate, locale, dateFormat) &&
                parseTime(nextClock, locale, timeFormat)
              ) {
                commit(nextDate, nextClock);
              }
            }}
            onBlur={() => {
              if (dateText.trim()) {
                commit(dateText, timeText);
              } else if (!timeText.trim()) {
                clearDate();
              } else {
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
            ref={triggerRef}
            type="button"
            className={styles.iconButton}
            aria-label={text.calendar}
            aria-haspopup="dialog"
            aria-controls={dialogId}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={openPopover}
          >
            <FaCalendarAlt aria-hidden="true" />
          </button>
        </div>
      </div>
      <p id={`${id}-zone`} className={styles.zone}>
        {text.zone} {timeZone}
      </p>
      {(dateError || timeError) && !mode && (
        <p className={styles.error} role="alert">
          {dateError || timeError}
        </p>
      )}
      {occurrences.length > 1 && !mode && (
        <div role="group" aria-label={text.overlap}>
          {occurrences.map((occurrence, index) => (
            <AdminButton
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
            </AdminButton>
          ))}
        </div>
      )}
      <dialog
        ref={dialogRef}
        id={dialogId}
        className={styles.dialog}
        popover="auto"
        aria-label={text.chooseDate}
        onCancel={(event) => {
          event.preventDefault();
          closePopover();
        }}
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
        <>
          <>
            {dateError && (
              <p className={styles.error} role="alert">
                {dateError}
              </p>
            )}
            {timeError && (
              <p className={styles.error} role="alert">
                {timeError}
              </p>
            )}
            {occurrences.length > 1 && (
              <div role="group" aria-label={text.overlap}>
                {occurrences.map((occurrence, index) => (
                  <AdminButton
                    key={occurrence.instant}
                    type="button"
                    size="sm"
                    onClick={() => {
                      clearTimeError();
                      onValidityChange?.(true);
                      onChange(occurrence.instant);
                      closePopover();
                    }}
                  >
                    {index === 0 ? text.first : text.second} (UTC
                    {occurrence.offset})
                  </AdminButton>
                ))}
              </div>
            )}
            <header className={styles.header}>
              <button
                className={styles.iconControl}
                type="button"
                aria-label={
                  view === "year"
                    ? text.previousYearRange
                    : view === "month"
                      ? text.previousYear
                      : text.previous
                }
                onClick={() =>
                  view === "year"
                    ? setYearRangeStart((start) => start - 12)
                    : setCursor(
                        localDate(
                          displayedYear,
                          displayedMonth + (view === "month" ? -12 : -1),
                          1,
                        ),
                      )
                }
              >
                <FaChevronLeft />
              </button>
              <div className={styles.monthYear}>
                {view === "day" && (
                  <button
                    ref={monthViewButtonRef}
                    type="button"
                    aria-label={`${text.month}: ${monthOptions[displayedMonth]?.label}`}
                    onClick={() => {
                      setViewHistory((history) => [
                        ...history,
                        { view, focus: "month" },
                      ]);
                      setView("month");
                    }}
                  >
                    {monthOptions[displayedMonth]?.label}
                  </button>
                )}
                <button
                  ref={yearViewButtonRef}
                  type="button"
                  aria-label={text.year}
                  onClick={() => {
                    setViewHistory((history) => [
                      ...history,
                      { view, focus: "year" },
                    ]);
                    setYearRangeStart(Math.floor(displayedYear / 12) * 12);
                    setView("year");
                  }}
                >
                  {view === "year"
                    ? `${yearRangeStart}–${yearRangeStart + 11}`
                    : displayedYear}
                </button>
                <span className="sr-only" aria-live="polite">
                  {labels.format(cursor)}
                </span>
              </div>
              <button
                className={styles.iconControl}
                type="button"
                aria-label={
                  view === "year"
                    ? text.nextYearRange
                    : view === "month"
                      ? text.nextYear
                      : text.next
                }
                onClick={() =>
                  view === "year"
                    ? setYearRangeStart((start) => start + 12)
                    : setCursor(
                        localDate(
                          displayedYear,
                          displayedMonth + (view === "month" ? 12 : 1),
                          1,
                        ),
                      )
                }
              >
                <FaChevronRight />
              </button>
            </header>
            {view === "day" ? (
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
                    aria-pressed={draftDateKey === dateKey(day)}
                    aria-label={new Intl.DateTimeFormat(locale, {
                      dateStyle: "full",
                      timeZone: "UTC",
                    }).format(day)}
                    tabIndex={dateKey(day) === (draftDateKey || today) ? 0 : -1}
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
                      selectCalendarDate(day);
                    }}
                  >
                    {new Intl.DateTimeFormat(locale, {
                      day: "numeric",
                      timeZone: "UTC",
                    }).format(day)}
                  </button>
                ))}
              </div>
            ) : (
              <div
                className={styles.selectionGrid}
                role="group"
                aria-label={view === "month" ? text.month : text.year}
              >
                {(view === "month" ? monthOptions : yearOptions).map((item) => {
                  const label =
                    typeof item === "number" ? String(item) : item.label;
                  const selected =
                    typeof item === "number"
                      ? item === displayedYear
                      : item.value === displayedMonth;

                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={selected}
                      tabIndex={selected ? 0 : -1}
                      onKeyDown={(event) => {
                        const offsets: Record<string, number> = {
                          ArrowLeft: -1,
                          ArrowRight: 1,
                          ArrowUp: -3,
                          ArrowDown: 3,
                        };
                        const offset = offsets[event.key];

                        if (offset === undefined) {
                          return;
                        }

                        const buttons = Array.from(
                          event.currentTarget.parentElement?.querySelectorAll(
                            "button",
                          ) ?? [],
                        );
                        const nextIndex =
                          buttons.indexOf(event.currentTarget) + offset;

                        if (nextIndex >= 0 && nextIndex < buttons.length) {
                          event.preventDefault();
                          buttons[nextIndex]?.focus();
                        }
                      }}
                      onClick={() => {
                        if (typeof item === "number") {
                          setCursor(localDate(item, displayedMonth, 1));
                          setView("month");
                        } else {
                          setCursor(localDate(displayedYear, item.value, 1));
                          setView("day");
                        }
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </>
          <div className={styles.timeRow}>
            <>
              {view === "day" ? (
                <AdminButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  color="neutral"
                  className={`${styles.iconControl} ${styles.todayButton}`}
                  onClick={selectToday}
                >
                  {text.today}
                </AdminButton>
              ) : (
                <button
                  type="button"
                  className={styles.iconControl}
                  aria-label={text.back}
                  title={text.back}
                  onClick={returnFromSelection}
                >
                  <FaArrowLeft aria-hidden="true" />
                </button>
              )}
            </>
            <div className={styles.timeControls}>
              <div className={styles.timePicker}>
                {(["Hour", "Minute"] as const).map((label) => {
                  const hourField = label === "Hour";
                  const fieldLabel = hourField ? text.hour : text.minute;
                  const time = parseTime(draftTime, locale, timeFormat) ?? {
                    hours: 0,
                    minutes: 0,
                  };

                  const twelveHour = timeFormat.startsWith("12h");
                  const current = hourField
                    ? twelveHour
                      ? time.hours % 12 || 12
                      : time.hours
                    : time.minutes;
                  const limit = hourField ? (twelveHour ? 12 : 24) : 60;

                  const step = (amount: number) => {
                    const next = (current + amount + limit) % limit;
                    const hours = hourField
                      ? twelveHour
                        ? (next % 12) + (time.hours >= 12 ? 12 : 0)
                        : next
                      : time.hours;
                    const minutes = hourField ? time.minutes : next;
                    updateSelectedTime({ hours, minutes });
                  };

                  return (
                    <div key={label}>
                      <label htmlFor={`${id}-${label.toLowerCase()}`}>
                        {fieldLabel}
                      </label>
                      <span className={styles.stepper}>
                        <input
                          aria-label={fieldLabel}
                          id={`${id}-${label.toLowerCase()}`}
                          type="text"
                          inputMode="numeric"
                          value={String(current).padStart(2, "0")}
                          onChange={(event) => {
                            if (
                              /^\d{0,2}$/.test(event.target.value) &&
                              (!twelveHour || Number(event.target.value) > 0) &&
                              (event.target.value === "" ||
                                Number(event.target.value) < limit)
                            ) {
                              if (!event.target.value) {
                                return;
                              }

                              const next = Number(event.target.value);
                              const hours = hourField
                                ? twelveHour
                                  ? (next % 12) + (time.hours >= 12 ? 12 : 0)
                                  : next
                                : time.hours;
                              const minutes = hourField ? time.minutes : next;
                              updateSelectedTime({ hours, minutes });
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
                      </span>
                    </div>
                  );
                })}
              </div>
              {timeFormat.startsWith("12h") && (
                <div
                  className={styles.periodControl}
                  role="group"
                  aria-label={text.time}
                >
                  {["AM", "PM"].map((period) => {
                    const time = parseTime(draftTime, locale, timeFormat) ?? {
                      hours: 0,
                      minutes: 0,
                    };
                    const selected =
                      period === "AM" ? time.hours < 12 : time.hours >= 12;
                    const label =
                      period === "AM"
                        ? periodLabel(9, locale)
                        : periodLabel(21, locale);

                    return (
                      <AdminToggleButton
                        key={period}
                        type="button"
                        size="sm"
                        variant={selected ? "soft" : "outline"}
                        pressed={selected}
                        onClick={() => {
                          const hours =
                            period === "AM"
                              ? time.hours % 12
                              : (time.hours % 12) + 12;
                          updateSelectedTime({ ...time, hours });
                        }}
                      >
                        {label ?? period}
                      </AdminToggleButton>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
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
  const adminLocale = useAdminLocale();
  const settings = useContext(AdminDateTimeContext);

  if (!settings) {
    return <p role="alert">{pickerMessages[adminLocale].unavailable}</p>;
  }

  return (
    <PublicationDatePickerFields
      {...props}
      key={JSON.stringify([settings.timeZone, locale])}
      locale={locale}
      timeZone={settings.timeZone}
      dateFormat={settings.dateFormat}
      timeFormat={settings.timeFormat}
    />
  );
}
