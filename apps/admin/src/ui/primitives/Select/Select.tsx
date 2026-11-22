"use client";

import { useId, type ChangeEvent } from "react";
import { FiChevronDown } from "react-icons/fi";

import { FieldFeedback, FieldLabel, fieldDescription } from "../FieldFeedback";

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
  defaultValue,
  name,
  required,
  options,
  onChangeAction,
  disabled,
  placeholder,
  "aria-describedby": externalDescription,
  "aria-invalid": invalid,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id || generatedId;

  const widthCls = fullWidth ? "w-full" : "";
  const describedBy = fieldDescription({
    id: selectId,
    hint,
    error,
    describedBy: externalDescription,
  });

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChangeAction?.(e.target.value);
  };

  return (
    <div className="form-control">
      <FieldLabel id={selectId} label={label} required={required} />

      <div className={cx("admin-select-trigger", widthCls)}>
        <select
          id={selectId}
          aria-invalid={error ? true : invalid}
          aria-describedby={describedBy}
          disabled={disabled}
          className={cx("select", className)}
          name={name}
          required={required}
          defaultValue={
            value === undefined
              ? (defaultValue ?? (placeholder ? "" : undefined))
              : undefined
          }
          value={value}
          onChange={handleChange}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}

          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <FiChevronDown className="admin-select-chevron" aria-hidden="true" />
      </div>

      <FieldFeedback id={selectId} hint={hint} error={error} />
    </div>
  );
}
