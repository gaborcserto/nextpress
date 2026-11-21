"use client";

import styles from "./BlogShell.module.css";

import type { KeyboardEvent, ReactNode } from "react";

export function MenuDisclosure({
  label,
  title,
  children,
}: {
  label?: string;
  title: ReactNode;
  children: ReactNode;
}) {
  function closeOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
    const details = event.currentTarget;

    if (event.key === "Escape" && details.open) {
      event.stopPropagation();
      details.open = false;
      details.querySelector("summary")?.focus();
    }
  }

  return (
    <details className={styles.menuDisclosure} onKeyDown={closeOnEscape}>
      <summary aria-label={label}>{title}</summary>
      {children}
    </details>
  );
}
