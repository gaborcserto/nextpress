"use client";

import type { BoxProps } from "./Box.types";

/**
 * Box – a simple UI surface wrapper.
 * Adds background, border, rounding, shadow and padding unless `bare` is true.
 */
export default function Box({
  children,
  className,
  bare,
  ...rest
}: BoxProps) {
  return (
      <div
          className={[
            !bare && "bg-base-100 border border-base-300 rounded-[var(--radius-surface)] shadow-sm p-6",
            className,
          ]
          .filter(Boolean)
          .join(" ")}
          {...rest}
      >
        {children}
      </div>
  );
}
