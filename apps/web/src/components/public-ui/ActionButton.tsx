import styles from "./public-ui.module.scss";

import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

type ActionButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
> & {
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
  className?: string;
};

export function ActionButton({
  children,
  className,
  ...attributes
}: ActionButtonProps) {
  return (
    <button
      className={[styles.action, styles.actionButton, className]
        .filter(Boolean)
        .join(" ")}
      {...attributes}
    >
      {children}
    </button>
  );
}
