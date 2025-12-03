"use client";

import { useId, type ChangeEvent } from "react";

import type { SelectProps } from "./Select.types";

/** Join classNames like in `Input` component */
const cx = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

export default function Select({
  label,
  hint,
  error,
  id,
  fullWidth,
  className,
  value,
  options,
  onChangeAction,
  disabled,
  placeholder,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id || generatedId;

  const widthCls = fullWidth ? "w-full" : "";
  const describedBy = error
    ? `${selectId}-error`
    : hint
      ? `${selectId}-hint`
      : undefined;

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChangeAction?.(e.target.value);
  };

  return (
    <div className="form-control">
      {label && (
        <label htmlFor={selectId} className="label">
          <span className="label-text">{label}</span>
        </label>
      )}

      <select
        id={selectId}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        disabled={disabled}
        className={cx("select select-bordered", widthCls, className)}
        value={value}
        onChange={handleChange}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}

        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
          >
            {opt.label}
          </option>
        ))}
      </select>

      {hint && !error && (
        <span id={`${selectId}-hint`} className="label-text-alt">
          {hint}
        </span>
      )}

      {error && (
        <span
          id={`${selectId}-error`}
          className="label-text-alt text-error"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}
