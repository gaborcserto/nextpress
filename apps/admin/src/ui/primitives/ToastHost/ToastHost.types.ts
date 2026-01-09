import {
  TOAST_POSITIONS,
  type ToastPosition,
  type ToastType
} from "@/ui/utils";

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

