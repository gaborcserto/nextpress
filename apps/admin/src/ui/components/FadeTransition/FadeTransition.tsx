"use client";

import type { FadeTransitionProps } from "./FadeTransition.types";

/**
 * A tiny universal transition helper:
 * - When `in = true`: element fades/flies in.
 * - When `in = false`: fade out, then unmount via `onExitedAction`.
 */
export function FadeTransition({
  in: inProp,
  duration = 200,
  onExitedAction,
  children,
}: FadeTransitionProps) {
  const handleTransitionEnd = () => {
    if (!inProp) {
      onExitedAction?.();
    }
  };

  return (
    <div
      className="transition-all ease-out"
      style={{
        transitionDuration: `${duration}ms`,
        opacity: inProp ? 1 : 0,
        transform: inProp ? "translateY(0)" : "translateY(0.5rem)",
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {children}
    </div>
  );
}
