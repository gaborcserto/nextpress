import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PublicationDatePicker from "./PublicationDatePicker";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PublicationDatePicker", () => {
  it("opens the calendar and closes on Escape, restoring focus", () => {
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
    render(
      <PublicationDatePicker id="publish-at" value={null} onChange={vi.fn()} />,
    );

    const trigger = screen.getByRole("button", { name: "Open calendar" });
    fireEvent.click(trigger);
    const dialog = document.querySelector<HTMLDialogElement>("dialog");
    expect(dialog).toHaveAttribute("open");

    if (!dialog) {
      throw new Error("Calendar dialog was not rendered");
    }

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("converts date and time edits to local ISO values with minute precision", () => {
    const onChange = vi.fn();
    render(
      <PublicationDatePicker
        id="publish-at"
        value="2026-12-01T12:30:45.678Z"
        onChange={onChange}
      />,
    );

    const timeField = screen.getByLabelText("Publish time");
    expect(timeField).toHaveAttribute("type", "text");
    fireEvent.change(timeField, {
      target: { value: "13:45" },
    });
    fireEvent.blur(timeField);

    expect(onChange).toHaveBeenCalledWith(
      new Date(2026, 11, 1, 13, 45).toISOString(),
    );
  });

  it("rejects invalid manually entered dates and times", () => {
    const onChange = vi.fn();
    render(
      <PublicationDatePicker
        id="publish-at"
        value={null}
        onChange={onChange}
      />,
    );

    const dateField = screen.getByLabelText("Publish date");
    fireEvent.change(dateField, { target: { value: "02/30/2026" } });
    fireEvent.blur(dateField);
    expect(screen.getByRole("alert")).toHaveTextContent("valid date");

    fireEvent.change(dateField, { target: { value: "12/01/2026" } });
    fireEvent.blur(dateField);
    const timeField = screen.getByLabelText("Publish time");
    fireEvent.change(timeField, { target: { value: "25:72" } });
    fireEvent.blur(timeField);
    expect(screen.getByRole("alert")).toHaveTextContent("00:00 to 23:59");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("uses a custom time selector and exposes editable text fields only", () => {
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
    const onChange = vi.fn();
    render(
      <PublicationDatePicker
        id="publish-at"
        value="2026-12-01T12:30:45.678Z"
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("Publish date")).toHaveAttribute(
      "type",
      "text",
    );
    expect(screen.getByLabelText("Publish time")).toHaveAttribute(
      "type",
      "text",
    );
    fireEvent.click(screen.getByRole("button", { name: "Open time selector" }));
    fireEvent.change(screen.getByLabelText("Hour"), {
      target: { value: "16" },
    });
    fireEvent.change(screen.getByLabelText("Minute"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledWith(
      new Date(2026, 11, 1, 16, 0).toISOString(),
    );
  });

  it("clears the publication date and cancels without changing it", () => {
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
    const onChange = vi.fn();
    render(
      <PublicationDatePicker
        id="publish-at"
        value="2026-12-01T12:30:45.678Z"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
