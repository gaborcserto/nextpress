"use client";

import type { ConfirmDialogProps } from "./ConfirmDialog.types";
import { Button } from "@/ui/primitives/Buttons";

export function ConfirmDialog({
  open,
  title = "Are you sure?",
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor = "primary",
  loading = false,
  disableClose = false,
  onConfirmAction,
  onCancelAction,
}: ConfirmDialogProps) {
  if (!open) return null;

  const close = () => {
    if (disableClose || loading) return;
    onCancelAction();
  };

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="font-semibold text-lg">{title}</h3>

        {children ? <div className="mt-3 text-base-content/80">{children}</div> : null}

        <div className="modal-action">
          <Button variant="ghost" color="neutral" onClick={close} disabled={loading}>
            {cancelLabel}
          </Button>

          <Button color={confirmColor} loading={loading} onClick={onConfirmAction}>
            {confirmLabel}
          </Button>
        </div>
      </div>

      <div className="modal-backdrop" onClick={close} aria-hidden="true" />
    </div>
  );
}
