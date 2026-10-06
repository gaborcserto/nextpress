import styles from "./public-ui.module.scss";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type ActionLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className"> & {
  children: ReactNode;
  className?: string;
};

export function ActionLink({ children, className, ...attributes }: ActionLinkProps) {
  return (
    <a className={[styles.action, styles.actionLink, className].filter(Boolean).join(" ")} {...attributes}>
      {children}
    </a>
  );
}
