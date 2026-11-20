import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import LivePreview from "./LivePreview";

describe("Live Preview editing", () => {
  it("uses the acknowledged private snapshot without requesting legacy history", () => {
    const fetch = vi.spyOn(globalThis, "fetch");

    try {
      render(
        <LivePreview
          id="draft"
          privateSnapshot={{
            title: "Acknowledged private title",
            slug: "draft",
            content: "",
            excerpt: null,
            layout: "GALLERY",
            pageDocument: null,
          }}
          values={{ title: "Unsaved title", slug: "draft", type: "GALLERY" }}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Live Preview" }));
      const live = screen.getByRole("checkbox", {
        name: "Unsaved live updates",
      });

      expect(live).toBeEnabled();
      fireEvent.click(live);
      expect(live).not.toBeChecked();
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it("preserves unsaved fields across viewport and panel switches", () => {
    render(
      <LivePreview>
        <input aria-label="Draft title" defaultValue="Original" />
      </LivePreview>,
    );
    const input = screen.getByLabelText("Draft title");
    fireEvent.change(input, { target: { value: "Unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "Live Preview" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Viewport" }), {
      target: { value: "375px" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show editing" }));
    fireEvent.click(screen.getByRole("button", { name: "Show preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Live Preview" }));
    expect(input).toHaveValue("Unsaved");
  });
});
