import { FaTimes } from "react-icons/fa";

import { AdminIconButton } from "../Buttons";

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
      <AdminIconButton
        icon={FaTimes}
        iconSize={18}
        variant="ghost"
        className="admin-plain-icon-button"
        aria-label={closeLabel}
        title={closeLabel}
        disabled={disabled}
        onClick={onClose}
      />
    </div>
  );
}
