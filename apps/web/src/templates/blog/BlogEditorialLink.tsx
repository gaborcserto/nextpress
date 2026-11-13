import { EditorialArrow } from "@/components/public-ui/EditorialArrow";
import { LocaleLink as Link } from "@/lib/i18n/client";

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
      {arrow ? <EditorialArrow /> : null}
    </Link>
  );
}
