"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";

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
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();

    return () => returnFocusRef.current?.focus();
  }, [open]);

  const close = () => {
    if (disableClose || loading) return;
    onCancelAction();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={children ? descriptionId : undefined} onKeyDown={handleKeyDown}>
      <div className="modal-box" ref={dialogRef}>
        <h3 id={titleId} className="font-semibold text-lg">{title}</h3>

        {children ? <div id={descriptionId} className="mt-3 text-base-content/80">{children}</div> : null}

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
