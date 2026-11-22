"use client";

import { useId } from "react";

import { FieldFeedback, FieldLabel, fieldDescription } from "../FieldFeedback";

import type { ToggleProps } from "./Toggle.types";

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

function colorClass(
  variant: "toggle" | "checkbox",
  color?: ToggleProps["color"],
) {
  if (!color || color === "default") {
    return "";
  }

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

  const generatedId = useId();
  const inputId = inputProps.id ?? generatedId;
  const describedBy = fieldDescription({
    id: inputId,
    hint,
    error,
    describedBy: inputProps["aria-describedby"],
  });

  const baseCls = variant === "checkbox" ? "checkbox" : "toggle";

  const inputCls = cx(
    baseCls,
    sizeClass(variant, size),
    colorClass(variant, color),
    className,
  );

  return (
    <div className="form-control">
      <FieldLabel id={inputId} label={label} required={inputProps.required} />

      <label
        className={cx(
          "label admin-choice-label cursor-pointer justify-start gap-3",
          disabled && "opacity-60",
        )}
      >
        <input
          {...inputProps}
          id={inputId}
          type="checkbox"
          className={inputCls}
          checked={typeof checked === "boolean" ? checked : undefined}
          defaultChecked={
            typeof checked === "boolean" ? undefined : defaultChecked
          }
          disabled={disabled}
          aria-invalid={error ? true : inputProps["aria-invalid"]}
          aria-describedby={describedBy}
          onChange={(event) => onChangeAction?.(event.target.checked, event)}
        />

        {inlineLabel ? <span className="label-text">{inlineLabel}</span> : null}
      </label>

      <FieldFeedback id={inputId} hint={hint} error={error} />
    </div>
  );
}
