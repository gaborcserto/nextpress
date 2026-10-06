import styles from "./public-ui.module.scss";

export function SkipLink({ href = "#main-content", children = "Skip to main content" }: {
  href?: `#${string}`;
  children?: string;
}) {
  return <a className={styles.skipLink} href={href}>{children}</a>;
}
