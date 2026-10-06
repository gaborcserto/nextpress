import styles from "./public-ui.module.css";
import type { ReactNode } from "react";

export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={[styles.stack, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
