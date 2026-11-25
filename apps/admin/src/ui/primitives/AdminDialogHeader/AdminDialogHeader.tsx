import { FaTimes } from "react-icons/fa";

import { IconButton } from "../Buttons";

import type { ReactNode } from "react";

type AdminDialogHeaderProps = {
  title: ReactNode;
  titleId: string;
  closeLabel: string;
  onClose: () => void;
  disabled?: boolean;
};

export function AdminDialogHeader({
  title,
  titleId,
  closeLabel,
  onClose,
  disabled = false,
}: AdminDialogHeaderProps) {
  return (
    <div className="admin-dialog-header flex items-center justify-between gap-2">
      <h2
        id={titleId}
        className="text-lg leading-snug font-semibold wrap-anywhere"
      >
        {title}
      </h2>
      <IconButton
        icon={FaTimes}
        iconSize={18}
        shape="square"
        variant="ghost"
        className="size-10 min-h-10 min-w-10 p-0 text-(--control-icon) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-color)"
        aria-label={closeLabel}
        title={closeLabel}
        disabled={disabled}
        onClick={onClose}
      />
    </div>
  );
}
