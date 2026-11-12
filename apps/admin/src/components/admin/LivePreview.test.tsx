import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import LivePreview from "./LivePreview";

describe("Live Preview editing", () => {
  it("preserves unsaved fields across viewport and panel switches", () => {
    render(
      <LivePreview>
        <input aria-label="Draft title" defaultValue="Original" />
      </LivePreview>,
    );
    const input = screen.getByLabelText("Draft title");
    fireEvent.change(input, { target: { value: "Unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "Live Preview" }));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "375px" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Live Preview" }));
    expect(input).toHaveValue("Unsaved");
  });
});
