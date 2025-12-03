import type { InputVariant, UiColor, UiSize, UiRadius } from "@/ui/theme/types";
import type { InputHTMLAttributes, ReactNode } from "react";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  hint?: string;
  error?: string;
  variant?: InputVariant;
  color?: UiColor;
  size?: UiSize;
  rounded?: UiRadius;
  fullWidth?: boolean;
  className?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  clearable?: boolean;
};
