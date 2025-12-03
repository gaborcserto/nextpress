import type { HTMLAttributes } from "react";

export type BoxProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * If true, remove background, padding, border, rounded, shadow → plain div
   */
  bare?: boolean;
};
