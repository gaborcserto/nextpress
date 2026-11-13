import Link from "next/link";

import styles from "./BlogEditorialLink.module.css";

import type { ReactNode } from "react";

export function BlogEditorialLink({
  href,
  children,
  arrow = false,
}: {
  href: string;
  children: ReactNode;
  arrow?: boolean;
}) {
  return (
    <Link className={styles.link} href={href}>
      {children}
      {arrow ? (
        <svg
          className={styles.arrow}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 12h16m-6-6 6 6-6 6"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      ) : null}
    </Link>
  );
}
