import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminDateTimeProvider } from "@/lib/settings/admin-date-time";

import PublicationDatePicker from "./PublicationDatePicker";

import type { ComponentProps } from "react";

type PickerProps = ComponentProps<typeof PublicationDatePicker>;
type PickerSettings = NonNullable<
  ComponentProps<typeof AdminDateTimeProvider>["settings"]
>;

function renderPicker(
  overrides: Partial<PickerProps> = {},
  options: { settings?: PickerSettings | null } = {},
) {
  const onChange = overrides.onChange ?? vi.fn();
  const onValidityChange = overrides.onValidityChange;
  const props: PickerProps = {
    id: "publish-at",
    value: null,
    ...overrides,
    onChange,
  };
  const picker = (
    <PublicationDatePicker {...props} onValidityChange={onValidityChange} />
  );
  const result = options.settings
    ? render(
        <AdminDateTimeProvider settings={options.settings}>
          {picker}
        </AdminDateTimeProvider>,
      )
    : render(picker);

  return { ...result, onChange, onValidityChange };
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
    it("hydrates server markup before showing the local publication time", () => {
      const picker = (
        <PublicationDatePicker
          id="publish-at"
          value="2026-12-01T12:30:45.678Z"
          onChange={vi.fn()}
        />
      );
      const container = document.body.appendChild(
        document.createElement("div"),
      );
      container.innerHTML = renderToString(picker);
      const onRecoverableError = vi.fn();

      const result = render(picker, {
        container,
        hydrate: true,
        onRecoverableError,
      });

      const local = new Date("2026-12-01T12:30:45.678Z");
      const expectedTime = [local.getUTCHours(), local.getUTCMinutes()]
        .map((part) => String(part).padStart(2, "0"))
        .join(":");
      const combinedField = screen.getByLabelText(
        "Publish date and Publish time",
      );
      expect(combinedField).toHaveValue(`12/01/2026 ${expectedTime}`);
      expect(combinedField).toBeEnabled();
      expect(onRecoverableError).not.toHaveBeenCalled();
      result.unmount();
      container.remove();
    });
  });

  describe("calendar dialog and desktop popover", () => {
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
    it("converts date and time edits to local ISO values with minute precision", () => {
      const onChange = vi.fn();
      render(
        <PublicationDatePicker
          id="publish-at"
          value="2026-12-01T12:30:45.678Z"
          onChange={onChange}
        />,
      );

      const combinedField = screen.getByLabelText(
        "Publish date and Publish time",
      );
      expect(combinedField).toHaveAttribute("type", "text");
      fireEvent.change(combinedField, {
        target: { value: "12/01/2026 13:45" },
      });
      fireEvent.blur(combinedField);

      expect(onChange).toHaveBeenCalledWith("2026-12-01T13:45:00.000Z");
    });

    it("uses configured date and 12-hour time formats", () => {
      const onChange = vi.fn();
      render(
        <AdminDateTimeProvider
          settings={{ timeZone: "UTC", dateFormat: "mdy", timeFormat: "12h" }}
        >
          <PublicationDatePicker
            id="publish-at"
            value="2026-12-01T15:30:00.000Z"
            onChange={onChange}
          />
        </AdminDateTimeProvider>,
      );

      const combinedField = screen.getByLabelText(
        "Publish date and Publish time",
      );
      expect(combinedField).toHaveValue("12/01/2026 3:30 PM");
      fireEvent.change(combinedField, {
        target: { value: "12/01/2026 4:15 PM" },
      });
      fireEvent.blur(combinedField);

      expect(onChange).toHaveBeenCalledWith("2026-12-01T16:15:00.000Z");
    });

    it("updates a complete manually entered value immediately", () => {
      const onChange = vi.fn();
      render(
        <PublicationDatePicker
          id="publish-at"
          value={null}
          onChange={onChange}
        />,
      );
      const input = screen.getByLabelText("Publish date and Publish time");

      fireEvent.change(input, { target: { value: "2026-12-01 13:45" } });

      expect(onChange).toHaveBeenCalledWith("2026-12-01T13:45:00.000Z");
    });

    it("uses Today in the publication timezone and preserves the selected time", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-24T22:30:00.000Z"));
      mockDialog();
      const onChange = vi.fn();
      render(
        <AdminDateTimeProvider
          settings={{
            timeZone: "Europe/Budapest",
            dateFormat: "iso",
            timeFormat: "24h",
          }}
        >
          <PublicationDatePicker
            id="publish-at"
            value="2026-10-20T10:00:00.000Z"
            onChange={onChange}
          />
        </AdminDateTimeProvider>,
      );

      openCalendar();
      fireEvent.click(screen.getByRole("button", { name: "Today" }));

      expect(onChange).toHaveBeenCalledWith("2026-10-25T11:00:00.000Z");
    });

    it("clears an optional value through the combined input", () => {
      const onChange = vi.fn();
      render(
        <PublicationDatePicker
          id="publish-at"
          value="2026-12-01T12:30:00.000Z"
          onChange={onChange}
        />,
      );
      const input = screen.getByLabelText("Publish date and Publish time");

      fireEvent.change(input, { target: { value: "" } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith(null);
    });

    it("rejects invalid manually entered dates and times", () => {
      const onChange = vi.fn();
      render(
        <PublicationDatePicker
          id="publish-at"
          value="2026-12-01T12:30:00.000Z"
          onChange={onChange}
        />,
      );

      const combinedField = screen.getByLabelText(
        "Publish date and Publish time",
      );
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
      const onChange = vi.fn();
      render(
        <PublicationDatePicker
          id="publish-at"
          value="2026-12-01T12:30:00.000Z"
          onChange={onChange}
        />,
      );
      const input = screen.getByLabelText("Publish date and Publish time");

      fireEvent.change(input, { target: { value: "2026-12-02" } });
      fireEvent.blur(input);

      expect(screen.getByRole("alert")).toHaveTextContent("time");
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("calendar view navigation", () => {
    it("updates valid time edits immediately and keeps the picker open", () => {
      mockDialog();
      const onChange = vi.fn();
      render(
        <PublicationDatePicker
          id="publish-at"
          value="2026-12-01T12:30:45.678Z"
          onChange={onChange}
        />,
      );

      expect(
        screen.getByLabelText("Publish date and Publish time"),
      ).toHaveAttribute("type", "text");
      openCalendar();
      expect(
        screen.getByRole("button", { name: "Previous month" }),
      ).toBeVisible();
      expect(screen.getByLabelText("Hour")).toBeVisible();
      const dialog = document.querySelector("dialog");

      if (!dialog) {
        throw new Error("Expected the date and time picker dialog");
      }

      fireEvent.change(screen.getByLabelText("Hour"), {
        target: { value: "16" },
      });
      fireEvent.change(screen.getByLabelText("Minute"), {
        target: { value: "0" },
      });
      expect(onChange).toHaveBeenCalledWith("2026-12-01T16:00:00.000Z");
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

    it("navigates month and year views without changing the selected timestamp", () => {
      mockDialog();
      const onChange = vi.fn();
      render(
        <PublicationDatePicker
          id="publish-at"
          value="2026-12-01T12:30:00.000Z"
          onChange={onChange}
        />,
      );

      openCalendar();
      const yearRange = screen.getByRole("button", { name: "Year" });

      fireEvent.click(yearRange);
      expect(screen.getByRole("group", { name: "Year" })).toBeVisible();
      const visibleRange = yearRange.textContent;
      fireEvent.click(
        screen.getByRole("button", { name: "Previous 12 years" }),
      );
      expect(yearRange).not.toHaveTextContent(visibleRange ?? "");
      fireEvent.click(screen.getByRole("button", { name: "Next 12 years" }));
      expect(screen.getByRole("button", { name: "Year" })).toHaveTextContent(
        visibleRange ?? "",
      );

      fireEvent.click(screen.getByRole("button", { name: /Back/ }));
      expect(screen.getByRole("group", { name: "Choose day" })).toBeVisible();
      expect(yearRange).toHaveFocus();
      const monthButton = screen.getByRole("button", { name: "Month: Dec" });
      fireEvent.click(monthButton);
      expect(screen.getByRole("group", { name: "Month" })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Feb" }));
      expect(screen.getByRole("group", { name: "Choose day" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Month: Feb" })).toBeVisible();

      fireEvent.click(yearRange);
      fireEvent.click(screen.getByRole("button", { name: "2027" }));
      expect(screen.getByRole("group", { name: "Month" })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: /Back/ }));
      expect(screen.getByRole("group", { name: "Choose day" })).toBeVisible();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("applies the selected calendar date immediately and keeps the picker open", () => {
      mockDialog();
      const onChange = vi.fn();
      render(
        <PublicationDatePicker
          id="publish-at"
          value="2026-12-01T12:30:45.678Z"
          onChange={onChange}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Wednesday, December 2, 2026" }),
      );

      expect(onChange).toHaveBeenCalledWith("2026-12-02T12:30:00.000Z");
      expect(screen.getByRole("button", { name: "Next month" })).toBeVisible();
    });
  });

  describe("validity reporting", () => {
    it("reports invalid input and clears the invalid state after a valid value", () => {
      const onValidityChange = vi.fn();
      renderPicker({ value: "2026-12-01T12:30:00.000Z", onValidityChange });

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
});
