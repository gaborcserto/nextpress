"use client";

import { FaEye, FaEyeSlash, FaTimes } from "react-icons/fa";

import { useInput } from "./Input.hook";

import type { InputProps } from "./Input.types";

const cx = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

function Input(props: InputProps) {
  const {
    label,
    hint,
    error,
    variant = "solid",
    color,
    size = "md",
    rounded,
    fullWidth,
    className,
    leftIcon,
    rightIcon,
    clearable = false,
    defaultValue,
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
  } = useInput({ ...inputProps, defaultValue });

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
    rounded === undefined
      ? "rounded-[var(--radius-control)]"
      : rounded === "none"
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
    className,
  );

  const hasLeftIcon = !!leftIcon;
  const showClearButton =
    !isPassword && clearable && String(currentValue) !== "";
  const showPasswordToggle = isPassword;
  const showRightIcon = !isPassword && !!rightIcon && !clearable;

  const paddingStartCls = hasLeftIcon ? "ps-10" : "ps-(--space-control-inline)";
  const paddingEndCls =
    showPasswordToggle || showRightIcon || showClearButton
      ? "pe-12"
      : "pe-(--space-control-inline)";

  const inputClasses = cx(baseInputClasses, paddingStartCls, paddingEndCls);

  const messageId = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;
  const describedBy =
    cx(inputProps["aria-describedby"], messageId) || undefined;

  return (
    <div className="form-control w-full relative">
      {label && (
        <label htmlFor={inputId} className="label">
          <span className="label-text">{label}</span>
        </label>
      )}

      <div className="relative">
        {hasLeftIcon && (
          <span className="absolute start-3 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none">
            {leftIcon}
          </span>
        )}

        <input
          {...inputProps}
          id={inputId}
          type={actualType}
          aria-invalid={error ? true : inputProps["aria-invalid"]}
          aria-describedby={describedBy}
          className={inputClasses}
          value={currentValue}
          onChange={handleChange}
        />

        {showPasswordToggle && (
          <button
            type="button"
            aria-label="Show password"
            aria-pressed={showPassword}
            disabled={inputProps.disabled}
            className="absolute end-1 top-1/2 z-20 grid size-(--target-min) -translate-y-1/2 place-items-center rounded-(--radius-control) text-(--control-icon) enabled:hover:text-(--control-icon-hover) focus-visible:outline-(length:--focus-width) focus-visible:outline-offset-(--focus-offset) focus-visible:outline-(--focus-color)"
            onClick={() => setShowPassword((v) => !v)}
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
            disabled={inputProps.disabled || inputProps.readOnly}
            className="btn btn-ghost btn-circle absolute end-1 top-1/2 -translate-y-1/2"
            onClick={clear}
          >
            <FaTimes size={16} aria-hidden="true" />
          </button>
        )}

        {showRightIcon && (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none">
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

export default Input;
