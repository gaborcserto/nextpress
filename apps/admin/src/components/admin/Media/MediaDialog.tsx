"use client";

import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useModalDialog } from "@/ui/hooks/useModalDialog";
import { AdminDialogHeader } from "@/ui/primitives/AdminDialogHeader/AdminDialogHeader";

import { useMediaMessages } from "./messages";

export function MediaDialog({
  title,
  children,
  onClose,
  dismissible = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dismissible?: boolean;
}) {
  const ref = useModalDialog(true);
  const titleId = useId();
  const text = useMediaMessages();

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="admin-dialog admin-media-dialog"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();

        if (dismissible) {
          onClose();
        }
      }}
    >
      <AdminDialogHeader
        title={title}
        titleId={titleId}
        closeLabel={text.close}
        disabled={!dismissible}
        onClose={onClose}
      />
      {children}
    </dialog>,
    document.body,
  );
}
