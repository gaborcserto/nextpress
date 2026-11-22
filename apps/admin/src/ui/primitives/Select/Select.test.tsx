import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import Select from "./Select";

const options = [
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived", disabled: true },
  { label: "Published", value: "published" },
];

it("participates in native validation, form submission and reset", () => {
  const { container } = render(
    <form>
      <Select
        label="Status"
        name="status"
        options={options}
        placeholder="Choose a status"
        required
      />
    </form>,
  );
  const form = container.querySelector("form");

  if (!form) {
    throw new Error("The test form did not render");
  }

  const select = screen.getByRole("combobox", { name: "Status" });
  expect(form.checkValidity()).toBe(false);
  expect(screen.getByRole("option", { name: "Archived" })).toBeDisabled();

  fireEvent.change(select, { target: { value: "published" } });
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).get("status")).toBe("published");

  form.reset();
  expect(select).toHaveValue("");
  expect(form.checkValidity()).toBe(false);
});

it("supports controlled values and associates the active validation message", () => {
  const onChangeAction = vi.fn();
  const { rerender } = render(
    <Select
      label="Status"
      value="draft"
      options={options}
      onChangeAction={onChangeAction}
    />,
  );
  const select = screen.getByRole("combobox", { name: "Status" });
  fireEvent.change(select, { target: { value: "published" } });
  expect(onChangeAction).toHaveBeenCalledWith("published");
  expect(select).toHaveValue("draft");

  rerender(
    <Select
      label="Status"
      value="published"
      options={options}
      error="Status is unavailable."
      disabled
    />,
  );
  expect(select).toHaveValue("published");
  expect(select).toBeDisabled();
  expect(select).toHaveAttribute("aria-invalid", "true");
  expect(select).toHaveAccessibleDescription("Status is unavailable.");
});

it("keeps field instructions available when a validation error is shown", () => {
  render(
    <>
      <p id="status-context">Controls public visibility.</p>
      <Select
        label="Status"
        required
        hint="Choose a publication state."
        error="Select a status."
        aria-describedby="status-context"
        options={options}
      />
    </>,
  );
  const select = screen.getByRole("combobox", { name: "Status" });
  expect(select).toBeRequired();
  expect(select).toHaveAccessibleDescription(
    "Controls public visibility. Choose a publication state. Select a status.",
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Select a status.");
});
