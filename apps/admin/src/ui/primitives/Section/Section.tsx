"use client";

import type { SectionProps } from "./Section.types";

export default function Section({
  title,
  desc,
  headerAside,
  children,
  className,
  variant = "soft",
}: SectionProps) {
  const wrap =
    variant === "plain"
      ? "rounded-none bg-transparent border-none shadow-none px-0"
      : "admin-surface";

  return (
    <section className={[wrap, className].filter(Boolean).join(" ")}>
      <header
        className={
          variant === "plain"
            ? "mb-3.5 flex items-center justify-between gap-3"
            : "flex items-center justify-between gap-3 px-4 sm:px-6 pt-4 pb-3 border-b border-(--surface-border)"
        }
      >
        <div className="min-w-0">
          <h2 className="text-lg leading-snug font-semibold wrap-anywhere">
            {title}
          </h2>
          {desc && (
            <p className="mt-1 text-sm leading-relaxed text-(--text-muted)">
              {desc}
            </p>
          )}
        </div>
        {headerAside}
      </header>
      <div className={variant === "plain" ? "" : "p-4 sm:p-6"}>{children}</div>
    </section>
  );
}
