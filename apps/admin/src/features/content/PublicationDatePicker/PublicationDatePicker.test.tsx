import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminDateTimeProvider } from "@/lib/settings/admin-date-time";

import PublicationDatePicker from "./PublicationDatePicker";

import type { ComponentProps } from "react";

type PickerProps = ComponentProps<typeof PublicationDatePicker>;
type PickerSettings = NonNullable<
  ComponentProps<typeof AdminDateTimeProvider>["settings"]
>;

const utcSettings: PickerSettings = {
  timeZone: "UTC",
  dateFormat: "mdy",
  timeFormat: "24h",
};
const budapestSettings: PickerSettings = {
  timeZone: "Europe/Budapest",
  dateFormat: "iso",
  timeFormat: "24h",
};
const preciseTimestamp = "2026-12-01T12:30:45.678Z";
const overlapTimestamp = "2026-10-25T01:30:45.678Z";
const selectedTimestamp = "2026-12-01T12:30:00.000Z";

function renderPicker(
  overrides: Partial<Omit<PickerProps, "onChange">> = {},
  settings: PickerSettings | null = utcSettings,
) {
  const onChange = vi.fn<PickerProps["onChange"]>();
  render(
    <AdminDateTimeProvider settings={settings}>
      <PublicationDatePicker
        id="publish-at"
        value={null}
        onChange={onChange}
        {...overrides}
      />
    </AdminDateTimeProvider>,
  );

  return { onChange };
}

function renderControlledPicker(initialValue: string, settings = utcSettings) {
  const onChange = vi.fn<PickerProps["onChange"]>();

  function ControlledPicker() {
    const [value, setValue] = useState<string | null>(initialValue);

    function changeValue(next: string | null) {
      onChange(next);
      setValue(next);
    }

    return (
      <AdminDateTimeProvider settings={settings}>
        <PublicationDatePicker
          id="publish-at"
          value={value}
          onChange={changeValue}
        />
      </AdminDateTimeProvider>
    );
  }

  render(<ControlledPicker />);

  return onChange;
}

function mockDialog() {
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(
    function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  );
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(
    function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  );
}

function getCombinedInput() {
  return screen.getByLabelText("Publish date and Publish time");
}

function openCalendar() {
  fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
}

const originalMatchMedia = Object.getOwnPropertyDescriptor(
  window,
  "matchMedia",
);
const originalShowPopover = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "showPopover",
);

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  if (originalMatchMedia) {
    Object.defineProperty(window, "matchMedia", originalMatchMedia);
  } else {
    Reflect.deleteProperty(window, "matchMedia");
  }

  if (originalShowPopover) {
    Object.defineProperty(
      HTMLElement.prototype,
      "showPopover",
      originalShowPopover,
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
  }
});

describe("PublicationDatePicker", () => {
  describe("hydration", () => {
    it.each([
      {
        scenario: "provider-free defaults",
        settings: undefined,
        expected: "12/01/2026 12:30",
      },
      {
        scenario: "explicit Budapest settings",
        settings: budapestSettings,
        expected: "2026-12-01 13:30",
      },
    ])(
      "hydrates the publication time with $scenario",
      ({ settings, expected }) => {
        const picker = (
          <PublicationDatePicker
            id="publish-at"
            value={preciseTimestamp}
            onChange={vi.fn()}
          />
        );
        const ui = settings ? (
          <AdminDateTimeProvider settings={settings}>
            {picker}
          </AdminDateTimeProvider>
        ) : (
          picker
        );

        const container = document.body.appendChild(
          document.createElement("div"),
        );
        const onRecoverableError = vi.fn();

        try {
          container.innerHTML = renderToString(ui);
          expect(getCombinedInput()).toHaveValue(expected);
          render(ui, { container, hydrate: true, onRecoverableError });

          const combinedField = getCombinedInput();
          expect(combinedField).toHaveValue(expected);
          expect(combinedField).toBeEnabled();
          expect(onRecoverableError).not.toHaveBeenCalled();
        } finally {
          cleanup();
          container.remove();
        }
      },
    );
  });

  describe("availability and calendar presentation", () => {
    it("disables manual editing and calendar access", () => {
      const { onChange } = renderPicker({ disabled: true });

      expect(getCombinedInput()).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Open calendar" }),
      ).toBeDisabled();
      openCalendar();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("reports unavailable site settings without exposing an editor", () => {
      renderPicker({}, null);

      expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Open calendar" }),
      ).not.toBeInTheDocument();
    });

    it("opens the calendar and closes on Escape, restoring focus", () => {
      mockDialog();
      const { onChange } = renderPicker();

      const trigger = screen.getByRole("button", { name: "Open calendar" });
      fireEvent.click(trigger);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("open");

      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(dialog).not.toHaveAttribute("open");
      expect(trigger).toHaveFocus();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("dismisses from the dialog backdrop without committing", () => {
      mockDialog();
      const { onChange } = renderPicker({ value: preciseTimestamp });
      openCalendar();

      fireEvent.click(screen.getByRole("dialog"));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Open calendar" }),
      ).toHaveFocus();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("uses the anchored popover presentation at desktop widths", () => {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: vi.fn(() => ({
          matches: false,
          media: "(max-width: 48rem)",
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      const showPopover = vi.fn(function showPopover(this: HTMLElement) {
        this.setAttribute("data-popover-open", "");
      });
      Object.defineProperty(HTMLElement.prototype, "showPopover", {
        configurable: true,
        value: showPopover,
      });
      renderPicker();

      openCalendar();

      expect(showPopover).toHaveBeenCalledOnce();
      expect(document.querySelector("dialog")).toHaveAttribute(
        "data-popover-open",
        "",
      );
      expect(screen.getByLabelText("Hour")).toBeInTheDocument();
    });
  });

  describe("manual input", () => {
    it("commits a complete edit once before blur with minute precision", () => {
      const onChange = renderControlledPicker(preciseTimestamp);
      const input = getCombinedInput();
      expect(input).toHaveAttribute("type", "text");

      fireEvent.change(input, { target: { value: "12/01/2026 13:45" } });
      expect(onChange).toHaveBeenCalledExactlyOnceWith(
        "2026-12-01T13:45:00.000Z",
      );

      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("preserves the exact instant when leaving an untouched field", () => {
      const onValidityChange = vi.fn();
      const { onChange } = renderPicker({
        value: preciseTimestamp,
        onValidityChange,
      });
      const input = getCombinedInput();
      input.focus();

      fireEvent.blur(input);

      expect(input).toHaveValue("12/01/2026 12:30");
      expect(onValidityChange).toHaveBeenLastCalledWith(true);
      expect(onChange).not.toHaveBeenCalled();
    });

    it.each([
      {
        dateFormat: "dmy",
        display: "01/12/2026 12:30",
        edit: "02.12.2026 13:45",
      },
      {
        dateFormat: "ymd-dots",
        display: "2026.12.01. 12:30",
        edit: "2026.12.02. 13:45",
      },
    ] as const)(
      "displays and reads a $dateFormat calendar date",
      ({ dateFormat, display, edit }) => {
        const { onChange } = renderPicker(
          { value: selectedTimestamp },
          { ...utcSettings, dateFormat },
        );
        const input = getCombinedInput();
        expect(input).toHaveValue(display);

        fireEvent.change(input, { target: { value: edit } });

        expect(onChange).toHaveBeenCalledExactlyOnceWith(
          "2026-12-02T13:45:00.000Z",
        );
      },
    );

    it("uses configured date and 12-hour time formats", () => {
      const { onChange } = renderPicker(
        { value: "2026-12-01T15:30:00.000Z" },
        { ...utcSettings, timeFormat: "12h" },
      );

      const combinedField = getCombinedInput();
      expect(combinedField).toHaveValue("12/01/2026 3:30 PM");
      fireEvent.change(combinedField, {
        target: { value: "12/01/2026 4:15 PM" },
      });
      expect(onChange).toHaveBeenCalledExactlyOnceWith(
        "2026-12-01T16:15:00.000Z",
      );
    });

    it("creates an ISO value immediately from an empty field", () => {
      const { onChange } = renderPicker();
      const input = getCombinedInput();

      fireEvent.change(input, { target: { value: "2026-12-01 13:45" } });

      expect(onChange).toHaveBeenCalledWith("2026-12-01T13:45:00.000Z");
    });

    it("validates incomplete input on Enter and prevents form submission", () => {
      const onValidityChange = vi.fn();
      const { onChange } = renderPicker({
        value: selectedTimestamp,
        onValidityChange,
      });
      const input = getCombinedInput();

      fireEvent.change(input, { target: { value: "2026-12-02" } });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
      expect(screen.getByRole("alert")).toHaveTextContent("time");
      expect(onValidityChange).toHaveBeenLastCalledWith(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("clears an optional value through the combined input", () => {
      const { onChange } = renderPicker({ value: selectedTimestamp });
      const input = getCombinedInput();

      fireEvent.change(input, { target: { value: "" } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith(null);
    });

    it("rejects invalid manually entered dates and times", () => {
      const { onChange } = renderPicker({ value: selectedTimestamp });

      const combinedField = getCombinedInput();
      fireEvent.change(combinedField, {
        target: { value: "02/30/2026 10:00" },
      });
      fireEvent.blur(combinedField);
      expect(screen.getByRole("alert")).toHaveTextContent("valid date");

      fireEvent.change(combinedField, {
        target: { value: "12/01/2026 25:72" },
      });
      fireEvent.blur(combinedField);
      expect(screen.getByRole("alert")).toHaveTextContent("00:00 to 23:59");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("keeps the last valid timestamp for incomplete manual input", () => {
      const { onChange } = renderPicker({ value: selectedTimestamp });
      const input = getCombinedInput();

      fireEvent.change(input, { target: { value: "2026-12-02" } });
      fireEvent.blur(input);

      expect(screen.getByRole("alert")).toHaveTextContent("time");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("reports invalid input and clears the invalid state after a valid value", () => {
      const onValidityChange = vi.fn();
      renderPicker({ value: selectedTimestamp, onValidityChange });

      fireEvent.change(getCombinedInput(), {
        target: { value: "02/30/2026 10:00" },
      });
      fireEvent.blur(getCombinedInput());
      expect(onValidityChange).toHaveBeenLastCalledWith(false);

      fireEvent.change(getCombinedInput(), {
        target: { value: "12/02/2026 10:00" },
      });
      fireEvent.blur(getCombinedInput());
      expect(onValidityChange).toHaveBeenLastCalledWith(true);
    });
  });

  describe("calendar date selection", () => {
    beforeEach(mockDialog);

    it("preserves the precise resolved occurrence when selecting its own day", () => {
      const { onChange } = renderPicker(
        { value: overlapTimestamp },
        budapestSettings,
      );
      openCalendar();
      const calendar = within(screen.getByRole("dialog"));

      fireEvent.click(
        calendar.getByRole("button", {
          name: "Sunday, October 25, 2026",
          pressed: true,
        }),
      );

      expect(getCombinedInput()).toHaveValue("2026-10-25 02:30");
      expect(calendar.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        calendar.queryByRole("button", { name: /occurrence/i }),
      ).not.toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("uses Today in the publication timezone and preserves the selected time", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-24T22:30:00.000Z"));
      const { onChange } = renderPicker(
        { value: "2026-10-20T10:00:00.000Z" },
        budapestSettings,
      );

      openCalendar();
      fireEvent.click(screen.getByRole("button", { name: "Today" }));

      expect(onChange).toHaveBeenCalledWith("2026-10-25T11:00:00.000Z");
    });

    it("applies the selected calendar date immediately and keeps the picker open", () => {
      const { onChange } = renderPicker({ value: preciseTimestamp });

      fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Wednesday, December 2, 2026" }),
      );

      expect(onChange).toHaveBeenCalledWith("2026-12-02T12:30:00.000Z");
      expect(screen.getByRole("button", { name: "Next month" })).toBeVisible();
    });
  });

  describe("daylight-saving transitions", () => {
    it("commits the chosen occurrence inside the calendar and returns focus", () => {
      mockDialog();
      const onValidityChange = vi.fn();
      const { onChange } = renderPicker(
        { value: "2026-10-24T00:30:00.000Z", onValidityChange },
        budapestSettings,
      );
      openCalendar();
      const calendar = within(screen.getByRole("dialog"));

      fireEvent.click(
        calendar.getByRole("button", { name: "Sunday, October 25, 2026" }),
      );
      const occurrences = within(
        calendar.getByRole("group", { name: /occurs twice/ }),
      );
      expect(onValidityChange).toHaveBeenLastCalledWith(false);
      expect(onChange).not.toHaveBeenCalled();

      fireEvent.click(
        occurrences.getByRole("button", {
          name: "Second occurrence (UTC+01:00)",
        }),
      );

      expect(onChange).toHaveBeenCalledExactlyOnceWith(
        "2026-10-25T01:30:00.000Z",
      );
      expect(onValidityChange).toHaveBeenLastCalledWith(true);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Open calendar" }),
      ).toHaveFocus();
    });

    it("rejects a nonexistent wall time without committing it", () => {
      const onValidityChange = vi.fn();
      const { onChange } = renderPicker(
        { value: selectedTimestamp, onValidityChange },
        budapestSettings,
      );

      fireEvent.change(getCombinedInput(), {
        target: { value: "2026-03-29 02:30" },
      });

      expect(screen.getByRole("alert")).toHaveTextContent("does not exist");
      expect(
        screen.queryByRole("button", { name: /occurrence/i }),
      ).not.toBeInTheDocument();
      expect(onValidityChange).toHaveBeenLastCalledWith(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it.each([
      ["First occurrence (UTC+02:00)", "2026-10-25T00:30:00.000Z"],
      ["Second occurrence (UTC+01:00)", "2026-10-25T01:30:00.000Z"],
    ])(
      "commits the selected %s of an ambiguous wall time",
      (name, timestamp) => {
        const onValidityChange = vi.fn();
        const { onChange } = renderPicker(
          { value: selectedTimestamp, onValidityChange },
          budapestSettings,
        );

        fireEvent.change(getCombinedInput(), {
          target: { value: "2026-10-25 02:30" },
        });
        const options = within(
          screen.getByRole("group", { name: /occurs twice/ }),
        );
        expect(onValidityChange).toHaveBeenLastCalledWith(false);
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.click(options.getByRole("button", { name }));
        expect(onChange).toHaveBeenCalledExactlyOnceWith(timestamp);
        expect(onValidityChange).toHaveBeenLastCalledWith(true);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      },
    );
  });

  describe("calendar time editing", () => {
    beforeEach(mockDialog);

    it("updates valid time edits immediately and keeps the picker open", () => {
      const onChange = renderControlledPicker(preciseTimestamp);

      openCalendar();
      expect(
        screen.getByRole("button", { name: "Previous month" }),
      ).toBeVisible();
      expect(screen.getByLabelText("Hour")).toBeVisible();
      const dialog = screen.getByRole("dialog");
      const time = within(dialog);

      fireEvent.change(time.getByLabelText("Hour"), {
        target: { value: "16" },
      });
      expect(onChange).toHaveBeenCalledExactlyOnceWith(
        "2026-12-01T16:30:00.000Z",
      );
      fireEvent.change(time.getByLabelText("Minute"), {
        target: { value: "0" },
      });
      expect(onChange.mock.calls).toEqual([
        ["2026-12-01T16:30:00.000Z"],
        ["2026-12-01T16:00:00.000Z"],
      ]);
      expect(getCombinedInput()).toHaveValue("12/01/2026 16:00");
      expect(dialog).toHaveAttribute("open");
      expect(
        screen.queryByRole("button", { name: "Apply" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Clear" }),
      ).not.toBeInTheDocument();
    });

    it("switches between AM and PM without changing the date or minutes", () => {
      const { onChange } = renderPicker(
        { value: "2026-12-01T09:30:00.000Z" },
        { ...utcSettings, timeFormat: "12h" },
      );
      openCalendar();
      const dialog = within(screen.getByRole("dialog"));

      expect(
        dialog.getByRole("button", { name: "AM", pressed: true }),
      ).toBeVisible();
      fireEvent.click(dialog.getByRole("button", { name: "PM" }));

      expect(
        dialog.getByRole("button", { name: "PM", pressed: true }),
      ).toBeVisible();
      expect(onChange).toHaveBeenCalledExactlyOnceWith(
        "2026-12-01T21:30:00.000Z",
      );
    });

    it("wraps hour and minute steppers on arrow keys without changing the date", () => {
      const onChange = renderControlledPicker("2026-12-01T23:59:00.000Z");
      openCalendar();
      const dialog = within(screen.getByRole("dialog"));
      const hour = dialog.getByLabelText("Hour");
      const minute = dialog.getByLabelText("Minute");

      fireEvent.keyDown(hour, { key: "ArrowUp" });
      expect(hour).toHaveValue("00");
      fireEvent.keyDown(minute, { key: "ArrowUp" });
      expect(minute).toHaveValue("00");
      fireEvent.keyDown(minute, { key: "ArrowDown" });
      expect(minute).toHaveValue("59");
      fireEvent.keyDown(hour, { key: "ArrowDown" });
      expect(hour).toHaveValue("23");

      expect(onChange.mock.calls).toEqual([
        ["2026-12-01T00:59:00.000Z"],
        ["2026-12-01T00:00:00.000Z"],
        ["2026-12-01T00:59:00.000Z"],
        ["2026-12-01T23:59:00.000Z"],
      ]);
      expect(getCombinedInput()).toHaveValue("12/01/2026 23:59");
    });
  });

  describe("calendar view navigation", () => {
    beforeEach(mockDialog);

    function openSelectedCalendar() {
      const { onChange } = renderPicker({ value: selectedTimestamp });
      openCalendar();

      return { onChange, calendar: within(screen.getByRole("dialog")) };
    }

    it("moves day focus across a month boundary without selecting a date", () => {
      vi.useFakeTimers();
      const { onChange } = renderPicker({ value: selectedTimestamp });
      openCalendar();
      const calendar = within(screen.getByRole("dialog"));
      const selected = calendar.getByRole("button", {
        name: "Tuesday, December 1, 2026",
        pressed: true,
      });
      selected.focus();

      fireEvent.keyDown(selected, { key: "ArrowLeft" });
      act(() => vi.advanceTimersToNextFrame());

      expect(
        calendar.getByRole("button", { name: "Monday, November 30, 2026" }),
      ).toHaveFocus();
      expect(
        calendar.getByRole("button", {
          name: "Tuesday, December 1, 2026",
          pressed: true,
        }),
      ).toBeVisible();
      expect(onChange).not.toHaveBeenCalled();
    });

    it.each([
      {
        trigger: "Year",
        grid: "Year",
        selected: "2026",
        next: "2027",
        key: "ArrowRight",
      },
      {
        trigger: "Month: Dec",
        grid: "Month",
        selected: "Dec",
        next: "Nov",
        key: "ArrowLeft",
      },
    ])(
      "moves focus in the $grid grid without selecting",
      ({ trigger, grid, selected, next, key }) => {
        const { onChange, calendar } = openSelectedCalendar();
        fireEvent.click(calendar.getByRole("button", { name: trigger }));
        const options = within(calendar.getByRole("group", { name: grid }));
        const current = options.getByRole("button", {
          name: selected,
          pressed: true,
        });
        current.focus();

        fireEvent.keyDown(current, { key });

        expect(
          options.getByRole("button", { name: next, pressed: false }),
        ).toHaveFocus();
        expect(current).toHaveAttribute("aria-pressed", "true");
        expect(onChange).not.toHaveBeenCalled();
      },
    );

    it("pages through year ranges without committing", () => {
      const { onChange, calendar } = openSelectedCalendar();
      const year = calendar.getByRole("button", { name: "Year" });

      fireEvent.click(year);
      expect(calendar.getByRole("group", { name: "Year" })).toBeVisible();
      expect(year).toHaveTextContent("2016–2027");
      fireEvent.click(
        calendar.getByRole("button", { name: "Previous 12 years" }),
      );
      expect(year).toHaveTextContent("2004–2015");
      fireEvent.click(calendar.getByRole("button", { name: "Next 12 years" }));
      expect(year).toHaveTextContent("2016–2027");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("returns to days and restores focus from the year view without committing", () => {
      const { onChange, calendar } = openSelectedCalendar();
      const year = calendar.getByRole("button", { name: "Year" });

      fireEvent.click(year);
      fireEvent.click(calendar.getByRole("button", { name: /Back/ }));

      expect(calendar.getByRole("group", { name: "Choose day" })).toBeVisible();
      expect(year).toHaveFocus();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("returns to the chosen month without committing a day", () => {
      const { onChange, calendar } = openSelectedCalendar();

      fireEvent.click(calendar.getByRole("button", { name: "Month: Dec" }));
      const months = calendar.getByRole("group", { name: "Month" });
      expect(months).toBeVisible();
      fireEvent.click(within(months).getByRole("button", { name: "Feb" }));

      expect(calendar.getByRole("group", { name: "Choose day" })).toBeVisible();
      expect(
        calendar.getByRole("button", { name: "Month: Feb" }),
      ).toBeVisible();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("opens months for the chosen year and backs out without committing", () => {
      const { onChange, calendar } = openSelectedCalendar();
      const year = calendar.getByRole("button", { name: "Year" });

      fireEvent.click(year);
      const years = calendar.getByRole("group", { name: "Year" });
      fireEvent.click(within(years).getByRole("button", { name: "2027" }));
      expect(calendar.getByRole("group", { name: "Month" })).toBeVisible();
      expect(year).toHaveTextContent("2027");

      fireEvent.click(calendar.getByRole("button", { name: /Back/ }));
      expect(calendar.getByRole("group", { name: "Choose day" })).toBeVisible();
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
