import { BlogEditorialLink } from "@/templates/blog/BlogEditorialLink";

import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <section className={styles.content} aria-labelledby="not-found-title">
        <h1 className={styles.code} id="not-found-title">
          <span>4</span>
          <span className={styles.zero}>0</span>
          <span>4</span>
        </h1>
        <p className={styles.message}>Page not found</p>
        <p className={styles.description}>
          The page you’re looking for isn’t here.
        </p>
        <nav className={styles.navigation} aria-label="Recovery">
          <BlogEditorialLink href="/" arrow>
            Back to home
          </BlogEditorialLink>
        </nav>
      </section>
    </main>
  );
}
