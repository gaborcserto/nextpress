import { UiNav, UiText } from "@/lib/i18n/client";
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
        <p className={styles.message}>
          <UiText id="errors.notFound" />
        </p>
        <p className={styles.description}>
          <UiText id="errors.missingPage" />
        </p>
        <UiNav
          className={styles.navigation}
          label="accessibility.recoveryNavigation"
        >
          <BlogEditorialLink href="/" arrow>
            <UiText id="navigation.backHome" />
          </BlogEditorialLink>
        </UiNav>
      </section>
    </main>
  );
}
