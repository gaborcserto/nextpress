import type {
  ReactNode,
  ButtonHTMLAttributes,
  ComponentType,
} from "react";

export type Align = "start" | "end";

export type DropdownAction = (key: string | number) => void;

export type DropdownProps = {
  children: ReactNode;
  align?: Align;
  className?: string;
};

export type DropdownTriggerProps = {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
};

export type DropdownMenuProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  onAction?: DropdownAction;
};

export type ItemColor = "default" | "danger";

export type DropdownItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  itemKey: string | number;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  color?: ItemColor;
};

export type DropdownLabelProps = {
  children: ReactNode;
  className?: string;
};

export type DropdownDividerProps = {
  className?: string;
};
