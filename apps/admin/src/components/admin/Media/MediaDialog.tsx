"use client";

import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useModalDialog } from "@/ui/hooks/useModalDialog";
import { Button } from "@/ui/primitives";

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
      className="admin-dialog [inline-size:min(52rem,calc(100%_-_2rem))]"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();

        if (dismissible) {
          onClose();
        }
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          disabled={!dismissible}
          onClick={onClose}
        >
          {text.close}
        </Button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
