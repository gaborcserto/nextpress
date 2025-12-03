import type { ButtonVariant, UiColor, UiSize, UiRadius } from "@/ui/theme/types";
import type {
  ButtonHTMLAttributes,
  ComponentType,
  ReactNode,
} from "react";

export type Size  = UiSize;

export type BaseProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  color?: UiColor;
  size?: UiSize;
  fullWidth?: boolean;
  wide?: boolean;
  active?: boolean;
  loading?: boolean;
  className?: string;
};

export type IconProps = {
  icon?: ComponentType<{ size?: number }>;
  rightIcon?: ComponentType<{ size?: number }>;
  iconSize?: number;
};

export type ButtonProps = Omit<BaseProps, keyof IconProps> & {
  children: ReactNode;
};

type IconButtonBaseProps = Omit<BaseProps, "aria-label"> & {
  "aria-label": string;
};

export type IconButtonProps = IconButtonBaseProps &
  IconProps & {
  children?: ReactNode;
  shape?: "circle" | "square";
};
