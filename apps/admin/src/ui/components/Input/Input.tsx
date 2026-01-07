"use client";

import { FaEye, FaEyeSlash, FaTimes } from "react-icons/fa";

import { useInput } from "./Input.hook";
import type { InputProps } from "./Input.types";

const cx = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

export default function Input(props: InputProps) {
  const {
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
    clearable = false,
    ...inputProps
  } = props;

  const {
    inputId,
    currentValue,
    isPassword,
    actualType,
    showPassword,
    setShowPassword,
    handleChange,
    clear,
  } = useInput(inputProps);

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

  const baseInputClasses = cx(
    "input",
    sizeCls,
    colorCls,
    variantCls,
    widthCls,
    roundedCls,
    className
  );

  const hasLeftIcon = !!leftIcon;
  const showClearButton = !isPassword && clearable && !!currentValue;
  const showPasswordToggle = isPassword;
  const showRightIcon = !isPassword && !!rightIcon && !clearable;

  const paddingLeftCls = hasLeftIcon ? "pl-10" : "pl-4";
  const paddingRightCls =
    showPasswordToggle || showRightIcon || showClearButton ? "pr-12" : "pr-4";

  const inputClasses = cx(baseInputClasses, paddingLeftCls, paddingRightCls);

  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className="form-control w-full relative">
      {label && (
        <label htmlFor={inputId} className="label">
          <span className="label-text">{label}</span>
        </label>
      )}

      <div className="relative">
        {hasLeftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none">
            {leftIcon}
          </span>
        )}

        <input
          id={inputId}
          type={actualType}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={inputClasses}
          value={currentValue}
          onChange={handleChange}
          {...inputProps}
        />

        {showPasswordToggle && (
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-base-content/70 hover:text-base-content"
            onClick={() => setShowPassword(v => !v)}
          >
            {showPassword ? (
              <FaEyeSlash size={18} aria-hidden="true" />
            ) : (
              <FaEye size={18} aria-hidden="true" />
            )}
          </button>
        )}

        {showClearButton && (
          <button
            type="button"
            aria-label="Clear input"
            className="btn btn-ghost btn-circle absolute right-1 top-1/2 -translate-y-1/2"
            onClick={clear}
          >
            <FaTimes size={16} aria-hidden="true" />
          </button>
        )}

        {showRightIcon && (
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
