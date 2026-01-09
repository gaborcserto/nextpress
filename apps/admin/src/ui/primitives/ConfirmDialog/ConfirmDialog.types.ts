import type { UiColor } from "@/ui/theme/types";
import type { ReactNode } from "react";

export type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  children?: ReactNode;

  confirmLabel?: string;
  cancelLabel?: string;

  confirmColor?: Extract<UiColor, "primary" | "error" | "success" | "warning" | "neutral">;
  loading?: boolean;
  disableClose?: boolean;

  onConfirmAction: () => void;
  onCancelAction: () => void;
};

