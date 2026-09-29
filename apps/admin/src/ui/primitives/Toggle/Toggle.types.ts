import type { InputHTMLAttributes, ReactNode } from "react";

export type ToggleSize = "xs" | "sm" | "md" | "lg";

export type ToggleColor =
  | "primary"
  | "secondary"
  | "accent"
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "default";

export type ToggleVariant = "toggle" | "checkbox";

/**
 * Shared props for Toggle / Checkbox style.
 * Uses DaisyUI classes: `toggle` or `checkbox`.
 */
export type ToggleProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "size"
> & {
  id?: string;

  /** Optional label rendered above (like Input). */
  label?: string;

  /** Optional hint shown under the control (if no error). */
  hint?: string;

  /** Optional error shown under the control. */
  error?: string;

  /** DaisyUI style: toggle (default) or checkbox. */
  variant?: ToggleVariant;

  /** DaisyUI color class. */
  color?: ToggleColor;

  /** DaisyUI size class. */
  size?: ToggleSize;

  /**
   * Optional inline text (right side) next to the switch.
   * Useful in tables ("Enabled") or settings rows.
   */
  inlineLabel?: ReactNode;

  /**
   * Controlled checked value.
   * If omitted, component works uncontrolled with defaultChecked.
   */
  checked?: boolean;

  /** Uncontrolled initial value. */
  defaultChecked?: boolean;

  /**
   * Change handler, ergonomic form.
   * (Still passes through original event in second arg.)
   */
  onChangeAction?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
};
