"use client";

import type { BoxProps } from "./Box.types";

/**
 * Box – a simple UI surface wrapper.
 * Adds background, border, rounding and padding unless `bare` is true.
 */
export default function Box({ children, className, bare, ...rest }: BoxProps) {
  return (
    <div
      className={[!bare && "admin-surface p-4 sm:p-6", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
