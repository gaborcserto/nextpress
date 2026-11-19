import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminHeaderActions } from "./AdminHeaderActions";
import { EditorHeaderContext } from "./EditorHeaderContext";

describe("AdminHeaderActions", () => {
  it("renders actions inside the shared header slot", () => {
    const headerSlot = document.createElement("div");
    document.body.append(headerSlot);

    render(
      <EditorHeaderContext.Provider value={headerSlot}>
        <AdminHeaderActions>
          <button type="button">Create Post</button>
        </AdminHeaderActions>
      </EditorHeaderContext.Provider>,
    );

    expect(headerSlot).toContainElement(
      screen.getByRole("button", { name: "Create Post" }),
    );

    headerSlot.remove();
  });

  it("keeps actions inline outside the Admin shell", () => {
    render(
      <AdminHeaderActions>
        <button type="button">Create Page</button>
      </AdminHeaderActions>,
    );

    expect(screen.getByRole("button", { name: "Create Page" })).toBeVisible();
  });
});
