import { UiText } from "@/lib/i18n/client";

import styles from "./public-ui.module.scss";

export function SkipLink({
  href = "#main-content",
  children,
}: {
  href?: `#${string}`;
  children?: string;
}) {
  return (
    <a className={styles.skipLink} href={href}>
      {children ?? <UiText id="accessibility.skipMain" />}
    </a>
  );
}
