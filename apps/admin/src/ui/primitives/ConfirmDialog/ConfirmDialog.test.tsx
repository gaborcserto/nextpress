import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("focuses Cancel, closes on Escape, and restores focus to its trigger", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Delete user";
    document.body.append(trigger);
    trigger.focus();
    const onCancelAction = vi.fn();
    const view = render(
      <ConfirmDialog open title="Delete user?" onConfirmAction={vi.fn()} onCancelAction={onCancelAction}>
        This action cannot be undone.
      </ConfirmDialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Delete user?", description: "This action cannot be undone." });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveFocus();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancelAction).toHaveBeenCalledOnce();
    view.rerender(
      <ConfirmDialog open={false} onConfirmAction={vi.fn()} onCancelAction={onCancelAction} />,
    );
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("keeps Tab navigation inside the dialog", () => {
    render(<ConfirmDialog open onConfirmAction={vi.fn()} onCancelAction={vi.fn()} />);
    const confirm = screen.getByRole("button", { name: "Confirm" });
    confirm.focus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("keeps focus in the dialog while a destructive action is pending", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Delete user";
    document.body.append(trigger);
    trigger.focus();
    const onConfirmAction = vi.fn();
    const onCancelAction = vi.fn();
    const view = render(
      <ConfirmDialog open title="Delete user?" loading onConfirmAction={onConfirmAction} onCancelAction={onCancelAction} />,
    );

    const dialog = screen.getByRole("dialog", { name: "Delete user?" });
    const confirm = screen.getByRole("button", { name: /Confirm/ });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(confirm).toBeDisabled();
    expect(cancel).toBeDisabled();
    expect(dialog.querySelector(".modal-box")).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog.querySelector(".modal-box")).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancelAction).not.toHaveBeenCalled();
    expect(onConfirmAction).not.toHaveBeenCalled();
    expect(trigger).not.toHaveFocus();

    view.rerender(
      <ConfirmDialog open={false} onConfirmAction={onConfirmAction} onCancelAction={onCancelAction} />,
    );
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
