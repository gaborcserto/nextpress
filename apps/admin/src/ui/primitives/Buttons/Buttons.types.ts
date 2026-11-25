import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ComponentType,
  SVGProps,
  ReactNode,
} from "react";

import type { ButtonVariant, UiColor, UiSize } from "@/ui/theme/types";

export type ButtonAppearance = {
  variant?: ButtonVariant;
  color?: UiColor;
  size?: UiSize;
  fullWidth?: boolean;
  wide?: boolean;
  active?: boolean;
  className?: string;
};

type ButtonIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

export type IconProps = {
  icon?: ButtonIcon;
  rightIcon?: ButtonIcon;
  iconSize?: number;
};

export type NativeAdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  Omit<ButtonAppearance, "active">;

export type AdminButtonProps = NativeAdminButtonProps &
  Omit<IconProps, "rightIcon">;

export type AdminIconButtonProps = Omit<
  AdminButtonProps,
  "children" | "fullWidth" | "wide"
> & {
  icon: ButtonIcon;
  "aria-label": string;
  children?: never;
  shape?: "circle" | "square";
};

type TextToggleProps = Omit<AdminButtonProps, "children"> & {
  children: Exclude<ReactNode, undefined>;
};

export type AdminToggleButtonProps = (
  | Omit<AdminIconButtonProps, "aria-pressed">
  | Omit<TextToggleProps, "aria-pressed">
) & { pressed: boolean };

export type AdminAsyncButtonProps = Omit<AdminButtonProps, "aria-busy"> & {
  loading: boolean;
  loadingLabel?: ReactNode;
};

type LinkBaseProps = AnchorHTMLAttributes<HTMLAnchorElement> &
  ButtonAppearance & {
    disabled?: boolean;
    loading?: boolean;
  };

export type LinkButtonProps = Omit<LinkBaseProps, keyof IconProps> & {
  href: string;
  children: ReactNode;
};

type LinkIconButtonBaseProps = Omit<LinkBaseProps, "aria-label"> & {
  href: string;
  "aria-label": string;
};

export type LinkIconButtonProps = LinkIconButtonBaseProps &
  IconProps & {
    children?: ReactNode;
  };
