import styles from "./public-ui.module.scss";
import type { HTMLAttributes, ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  className?: string;
} & Pick<HTMLAttributes<HTMLDivElement>, "id" | "aria-label" | "aria-labelledby">;

export function Container({ children, className, ...attributes }: ContainerProps) {
  return (
    <div className={[styles.container, className].filter(Boolean).join(" ")} {...attributes}>
      {children}
    </div>
  );
}
