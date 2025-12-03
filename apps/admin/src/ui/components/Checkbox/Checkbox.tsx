"use client";

import { useId } from "react";

import type { CheckboxProps } from "./Checkbox.types";

const cx = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

export default function Checkbox({
  id,
  label,
  checked,
  onChangeAction,
  disabled,
  className,
}: CheckboxProps) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <label
      htmlFor={inputId}
      className={cx(
        "cursor-pointer flex items-center gap-2",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        className="checkbox"
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        onChange={(e) => onChangeAction?.(e.target.checked)}
      />
      {label && <span>{label}</span>}
    </label>
  );
}
