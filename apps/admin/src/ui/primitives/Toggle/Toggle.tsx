"use client";

import { useToggle } from "./Toggle.hook";
import type { ToggleProps } from "./Toggle.types";
import type { ReactNode } from "react";

const cx = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

function sizeClass(variant: "toggle" | "checkbox", size?: ToggleProps["size"]) {
  if (variant === "checkbox") {
    return size === "xs"
      ? "checkbox-xs"
      : size === "sm"
        ? "checkbox-sm"
        : size === "lg"
          ? "checkbox-lg"
          : "checkbox-md";
  }

  return size === "xs"
    ? "toggle-xs"
    : size === "sm"
      ? "toggle-sm"
      : size === "lg"
        ? "toggle-lg"
        : "toggle-md";
}

function colorClass(variant: "toggle" | "checkbox", color?: ToggleProps["color"]) {
  if (!color || color === "default") return "";
  return variant === "checkbox" ? `checkbox-${color}` : `toggle-${color}`;
}

export default function Toggle(props: ToggleProps) {
  const {
    label,
    inlineLabel,
    hint,
    error,
    variant = "toggle",
    color = "primary",
    size = "md",
    className,
    checked,
    defaultChecked,
    onChangeAction,
    disabled,
    ...inputProps
  } = props;

  const { inputId, describedBy, handleChange } = useToggle({
    id: props.id,
    checked,
    defaultChecked,
    hint,
    error,
    onChangeAction,
  });

  const baseCls = variant === "checkbox" ? "checkbox" : "toggle";

  const inputCls = cx(
    baseCls,
    sizeClass(variant, size),
    colorClass(variant, color),
    className
  );

  const below: ReactNode =
    error ? (
      <span id={`${inputId}-error`} className="label-text-alt text-error" role="alert">
        {error}
      </span>
    ) : hint ? (
      <span id={`${inputId}-hint`} className="label-text-alt">
        {hint}
      </span>
    ) : null;

  // We render:
  // - optional label above
  // - a row containing input + inlineLabel (clickable)
  // - hint/error below
  return (
    <div className="form-control">
      {label && (
        <label className="label" htmlFor={inputId}>
          <span className="label-text">{label}</span>
        </label>
      )}

      <label className={cx("label cursor-pointer justify-start gap-3", disabled && "opacity-60")}>
        <input
          {...inputProps}
          id={inputId}
          type="checkbox"
          className={inputCls}
          checked={typeof checked === "boolean" ? checked : undefined}
          defaultChecked={typeof checked === "boolean" ? undefined : defaultChecked}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={handleChange}
        />

        {inlineLabel ? <span className="label-text">{inlineLabel}</span> : null}
      </label>

      {below}
    </div>
  );
}
