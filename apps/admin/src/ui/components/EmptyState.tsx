import type { ReactNode } from "react";
import type { IconType } from "react-icons";

type EmptyStateProps = {
  icon: IconType;
  heading: string;
  description: string;
  action?: ReactNode;
  variant?: "panel" | "plain";
};

export function EmptyState({
  icon: Icon,
  heading,
  description,
  action,
  variant = "panel",
}: EmptyStateProps) {
  const surface =
    variant === "panel"
      ? "rounded-(--radius-control) border border-dashed border-(--surface-border) bg-(--surface-rail)"
      : "";

  return (
    <div
      className={`grid min-h-48 min-w-0 place-content-center justify-items-center gap-2 px-4 py-8 text-center ${surface}`}
      data-empty-state={variant}
      role="status"
    >
      <Icon aria-hidden="true" className="size-10 text-(--text-muted)" />
      <h3 className="text-base font-semibold">{heading}</h3>
      <p className="max-w-prose text-sm text-(--text-muted)">{description}</p>
      {action}
    </div>
  );
}
