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
          : "bg-base-100 border border-base-300 rounded-xl shadow-sm";

  return (
      <section className={[wrap, className].filter(Boolean).join(" ")}>
        <header className={variant === "plain" ? "mb-3" : "px-6 pt-5 pb-4 border-b border-base-300"}>
          <h2 className="text-base font-semibold">{title}</h2>
          {desc && <p className="text-sm text-base-content/70 mt-1">{desc}</p>}
        </header>
        <div className={variant === "plain" ? "" : "p-6"}>{children}</div>
      </section>
  );
}
