"use client";

import type { SectionProps } from "./Section.types";

export default function Section({
  title,
  desc,
  children,
  className,
  variant = "soft",
}: SectionProps) {
  const wrap =
    variant === "plain"
      ? "rounded-none bg-transparent border-none shadow-none px-0"
      : "bg-base-100 border border-base-300 rounded-[var(--radius-surface)]";

  return (
    <section className={[wrap, className].filter(Boolean).join(" ")}>
      <header
        className={
          variant === "plain"
            ? "mb-3.5"
            : "px-4 sm:px-6 pt-4 pb-3 border-b border-base-300"
        }
      >
        <h2 className="text-lg leading-snug font-semibold wrap-anywhere">
          {title}
        </h2>
        {desc && (
          <p className="mt-1 text-sm leading-relaxed text-(--text-muted)">
            {desc}
          </p>
        )}
      </header>
      <div className={variant === "plain" ? "" : "p-4 sm:p-6"}>{children}</div>
    </section>
  );
}
