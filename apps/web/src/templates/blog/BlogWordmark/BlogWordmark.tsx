import styles from "./BlogWordmark.module.css";

export function BlogWordmark({ siteName }: { siteName: string }) {
  const isNextPress = siteName.trim().toLowerCase() === "nextpress";

  return (
    <span className={styles.wordmark} data-nextpress={isNextPress}>
      {siteName}
      {isNextPress ? <span aria-hidden="true">.</span> : null}
    </span>
  );
}
