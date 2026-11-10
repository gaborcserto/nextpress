import type { ReactNode } from "react";

import type { UiStatus } from "@/ui/theme/types";

export type AlertProps = {
  message: string | null;
  status?: UiStatus; // "success" | "error" | "warning" | "info"
  icon?: ReactNode;
  className?: string;
};
