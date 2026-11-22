import type { ComponentPropsWithoutRef } from "react";

type BadgeProps = ComponentPropsWithoutRef<"span">;

export function Badge({ className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={["admin-badge", className].filter(Boolean).join(" ")}
    />
  );
}
