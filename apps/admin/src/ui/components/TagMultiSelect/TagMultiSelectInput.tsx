"use client";

import { forwardRef } from "react";

import type { TagMultiSelectInputProps } from "./TagMultiSelect.types";

/**
 * Lightweight input used inside TagMultiSelect.
 * Accepts regular <input> props (id, aria-*, etc).
 */
export const TagMultiSelectInput = forwardRef<
  HTMLInputElement,
  TagMultiSelectInputProps
>(function TagMultiSelectInput(
  { value, onChange, onKeyDown, placeholder, className, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={
        className ??
        "flex-1 bg-transparent outline-none border-none min-w-[6rem]"
      }
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      {...rest}
    />
  );
});
