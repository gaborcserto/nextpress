import type { ComponentPropsWithRef, ReactNode } from "react";

import type { InputVariant, UiColor, UiSize, UiRadius } from "@/ui/theme/types";

export type InputProps = Omit<ComponentPropsWithRef<"input">, "size"> & {
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
