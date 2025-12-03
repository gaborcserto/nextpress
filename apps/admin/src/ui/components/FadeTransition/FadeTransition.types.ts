import type { ReactNode } from "react";

export type FadeTransitionProps = {
  in: boolean;
  duration?: number;
  onExitedAction?: () => void;
  children: ReactNode;
};
