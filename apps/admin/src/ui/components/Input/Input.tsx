"use client";

import { useId, useState } from "react";
import { FaEye, FaEyeSlash, FaTimes } from "react-icons/fa";

import type { InputProps } from "./Input.types";
import type { ChangeEvent } from "react";

// util
const cx = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

export default function Input({
  label,
  hint,
  error,
  variant = "solid",
  color,
  size = "md",
  rounded = "md",
  fullWidth,
  className,
  leftIcon,
  rightIcon,
  clearable = false, // <-- default
  type = "text",
  id,
  onChange,
  value,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const [internalValue, setInternalValue] = useState(
    (value as string | undefined) ?? ""
  );

  const isControlled = value !== undefined;
  const currentValue = isControlled ? (value as string) : internalValue;

  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const actualType = isPassword ? (showPassword ? "text" : "password") : type;

  const sizeCls =
      size === "xs"
          ? "input-xs"
          : size === "sm"
          ? "input-sm"
          : size === "lg"
          ? "input-lg"
          : size === "xl"
          ? "input-xl"
          : "";

  const colorCls = color ? `input-${color}` : "";
  const variantCls = variant === "ghost" ? "input-ghost" : "";
  const widthCls = fullWidth ? "w-full" : "";

  const roundedCls =
      rounded === "none"
          ? "rounded-none"
          : rounded === "sm"
          ? "rounded-sm"
          : rounded === "md"
          ? "rounded-md"
          : rounded === "lg"
          ? "rounded-lg"
          : rounded === "xl"
          ? "rounded-xl"
          : "rounded-full";

  const inputClasses = cx(
      "input",
      sizeCls,
      colorCls,
      variantCls,
      widthCls,
      roundedCls,
      className
  );

  const describedBy =
      error
          ? `${inputId}-error`
          : hint
          ? `${inputId}-hint`
          : undefined;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setInternalValue(e.target.value);
    }
    onChange?.(e);
  };

  const clearInput = () => {
    if (!isControlled) {
      setInternalValue("");
    }

    const synthetic: ChangeEvent<HTMLInputElement> = {
      target: { value: "" } as HTMLInputElement,
    } as ChangeEvent<HTMLInputElement>;

    onChange?.(synthetic);
  };

  return (
      <div className="form-control w-full relative">
          {label && (
              <label htmlFor={inputId} className="label">
                <span className="label-text">{label}</span>
              </label>
          )}

      <div className="relative">
          {leftIcon && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none">
                  {leftIcon}
              </span>
          )}

      <input
          id={inputId}
          type={actualType}
          aria-invalid={!!error}
          aria-describedby={describedBy}

          className={cx(
                inputClasses,
                leftIcon ? "pl-10" : "pl-4",
                (isPassword || rightIcon || (clearable && currentValue)) ? "pr-12" : "pr-4"
          )}
          value={currentValue}
          onChange={handleChange}
          {...props}
      />

      {/* Password toggle */}
      {isPassword && (
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-base-content/70 hover:text-base-content"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? (
                <FaEyeSlash size={18} aria-hidden="true" />
            ) : (
                <FaEye size={18} aria-hidden="true" />
            )}
        </button>
      )}

      {/* Clear button (X) */}
      {!isPassword && clearable && currentValue && (
          <button
              type="button"
              aria-label="Clear input"
              className="btn btn-ghost btn-circle absolute right-1 top-1/2 -translate-y-1/2"
              onClick={clearInput}
          >
              <FaTimes size={16} aria-hidden="true" />
          </button>
      )}

      {/* Right icon */}
      {!isPassword && rightIcon && !clearable && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none">
              {rightIcon}
          </span>
      )}
  </div>

  {hint && !error && (
      <span id={`${inputId}-hint`} className="label-text-alt">
        {hint}
      </span>
  )}

  {error && (
      <span
          id={`${inputId}-error`}
    className="label-text-alt text-error"
    role="alert"
        >
        {error}
        </span>
  )}
  </div>
);
}

