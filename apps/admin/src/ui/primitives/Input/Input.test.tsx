import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Input from "./Input";

describe("Input rounding", () => {
  it("uses the skin default while preserving explicit radius overrides", () => {
    const { rerender } = render(<Input aria-label="Title" />);
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveClass(
      "rounded-[var(--radius-control)]",
    );

    rerender(<Input aria-label="Title" rounded="lg" />);
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveClass("rounded-lg");
    expect(screen.getByRole("textbox", { name: "Title" })).not.toHaveClass(
      "rounded-[var(--radius-control)]",
    );
  });
});
