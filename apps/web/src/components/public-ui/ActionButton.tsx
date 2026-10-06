import styles from "./public-ui.module.css";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  children: ReactNode;
  className?: string;
};

export function ActionButton({ children, className, ...attributes }: ActionButtonProps) {
  return (
    <button className={[styles.action, styles.actionButton, className].filter(Boolean).join(" ")} {...attributes}>
      {children}
    </button>
  );
}
