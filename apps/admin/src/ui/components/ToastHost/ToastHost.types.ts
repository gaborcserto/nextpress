import { TOAST_POSITIONS } from "@/ui/utils/toast";
import type { ToastPosition, ToastType } from "@/ui/utils/toast";

export const POSITIONS = TOAST_POSITIONS;

export type ActiveToast = {
  id: number;
  msg: string;
  desc?: string;
  type: ToastType;
  position: ToastPosition;
  isIn: boolean;   // true = active/entering, false = exiting
  timeout: number; // ms
};

