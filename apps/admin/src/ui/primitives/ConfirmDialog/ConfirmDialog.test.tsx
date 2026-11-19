import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("names the open modal, focuses Cancel and restores the trigger after dismissal", () => {
    const onCancelAction = vi.fn();
    const onConfirmAction = vi.fn();
    const view = render(<button>Delete user</button>);
    const trigger = screen.getByRole("button", { name: "Delete user" });
    trigger.focus();

    view.rerender(
      <>
        <button>Delete user</button>
        <ConfirmDialog
          open
          title="Delete user?"
          onCancelAction={onCancelAction}
          onConfirmAction={onConfirmAction}
        >
          This action cannot be undone.
        </ConfirmDialog>
      </>,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Delete user?",
      description: "This action cannot be undone.",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    expect(fireEvent(dialog, new Event("cancel", { cancelable: true }))).toBe(
      false,
    );
    expect(onCancelAction).toHaveBeenCalledOnce();
    view.rerender(
      <>
        <button>Delete user</button>
        <ConfirmDialog
          open={false}
          onCancelAction={onCancelAction}
          onConfirmAction={onConfirmAction}
        />
      </>,
    );
    expect(screen.getByRole("button", { name: "Delete user" })).toHaveFocus();
  });

  it("keeps focus in the dialog and disables dismissal while a destructive action is pending", () => {
    const onCancelAction = vi.fn();
    const onConfirmAction = vi.fn();

    render(
      <ConfirmDialog
        open
        loading
        title="Delete user?"
        onCancelAction={onCancelAction}
        onConfirmAction={onConfirmAction}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Delete user?" });
    expect(screen.getByRole("heading", { name: "Delete user?" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Please wait");
    expect(screen.getByRole("button", { name: /Confirm/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(fireEvent(dialog, new Event("cancel", { cancelable: true }))).toBe(
      false,
    );
    expect(onCancelAction).not.toHaveBeenCalled();
    expect(onConfirmAction).not.toHaveBeenCalled();
  });
});
