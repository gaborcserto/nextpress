import type { UiStatus } from "@/ui/theme/types";
import type { ReactNode } from "react";

export type AlertProps = {
  message: string | null;
  status?: UiStatus;     // "success" | "error" | "warning" | "info"
  icon?: ReactNode;
  className?: string;
};
