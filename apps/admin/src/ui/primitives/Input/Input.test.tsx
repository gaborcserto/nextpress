import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Input from "./Input";

describe("Input rounding", () => {
  it("uses the skin default while preserving explicit radius overrides", () => {
    const { rerender } = render(<Input aria-label="Title" />);
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveClass(
      "rounded-[var(--radius-control)]",
    );

    rerender(<Input aria-label="Title" rounded="lg" />);
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveClass(
      "rounded-lg",
    );
    expect(screen.getByRole("textbox", { name: "Title" })).not.toHaveClass(
      "rounded-[var(--radius-control)]",
    );
  });
});

it("keeps the password visibility control named and exposes its pressed state", () => {
  const { rerender } = render(<Input type="password" label="Password" />);
  const field = screen.getByLabelText("Password", { exact: true });
  const toggle = screen.getByRole("button", { name: "Show password" });

  fireEvent.click(toggle);
  expect(field).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  rerender(<Input type="password" label="Password" disabled />);
  expect(toggle).toBeDisabled();
});

it.each([{ disabled: true }, { readOnly: true }])(
  "disables clearing when the input cannot be edited (%j)",
  (inputProps) => {
    render(
      <Input label="Title" defaultValue="Draft" clearable {...inputProps} />,
    );
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Draft");
    expect(screen.getByRole("button", { name: "Clear input" })).toBeDisabled();
  },
);

it("allows an editable default value of zero to be cleared", () => {
  render(<Input type="number" label="Count" defaultValue={0} clearable />);
  const count = screen.getByRole("spinbutton", { name: "Count" });
  expect(count).toHaveValue(0);

  fireEvent.click(screen.getByRole("button", { name: "Clear input" }));
  expect(count).toHaveValue(null);
  expect(screen.queryByRole("button", { name: "Clear input" })).toBeNull();
});

it("retains an external description alongside its validation message", () => {
  render(
    <>
      <p id="format-hint">Use a canonical URL.</p>
      <Input
        label="Site URL"
        type="url"
        aria-describedby="format-hint"
        error="Enter a URL."
      />
    </>,
  );
  expect(
    screen.getByRole("textbox", { name: "Site URL" }),
  ).toHaveAccessibleDescription("Use a canonical URL. Enter a URL.");
});
