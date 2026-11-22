"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { FaCheck, FaTimes, FaTrash } from "react-icons/fa";

import { useModalDialog } from "@/ui/hooks/useModalDialog";
import { Alert } from "@/ui/primitives/Alert";
import { Button } from "@/ui/primitives/Buttons";

import type { ConfirmDialogProps } from "./ConfirmDialog.types";

export function ConfirmDialog({
  open,
  title = "Are you sure?",
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor = "primary",
  loading = false,
  error,
  disableClose = false,
  onConfirmAction,
  onCancelAction,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useModalDialog(open);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const canDismiss = !disableClose && !loading;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    if (!canDismiss) {
      titleRef.current?.focus();

      return;
    }

    actionsRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open, canDismiss]);

  function dismiss() {
    if (canDismiss) {
      onCancelAction();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="admin-dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={children ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const { left, top, right, bottom } =
            event.currentTarget.getBoundingClientRect();

          if (
            event.clientX < left ||
            event.clientX > right ||
            event.clientY < top ||
            event.clientY > bottom
          ) {
            dismiss();
          }
        }
      }}
    >
      {open && (
        <>
          <h2
            id={titleId}
            ref={titleRef}
            tabIndex={-1}
            className="font-semibold text-lg"
          >
            {title}
          </h2>
          {children && (
            <div id={descriptionId} className="mt-3 text-(--text-muted)">
              {children}
            </div>
          )}
          {error && <Alert message={error} status="error" className="mt-3" />}
          {loading && (
            <p role="status" className="mt-3">
              Please wait…
            </p>
          )}
          <div
            ref={actionsRef}
            className="mt-6 flex flex-wrap justify-end gap-2"
          >
            <Button
              variant="ghost"
              color="neutral"
              onClick={dismiss}
              disabled={!canDismiss}
            >
              <FaTimes aria-hidden="true" />
              {cancelLabel}
            </Button>
            <Button
              color={confirmColor}
              loading={loading}
              onClick={onConfirmAction}
            >
              {confirmColor === "error" ? (
                <FaTrash aria-hidden="true" />
              ) : (
                <FaCheck aria-hidden="true" />
              )}
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
