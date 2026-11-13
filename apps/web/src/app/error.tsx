"use client";

import { ActionButton } from "@/components/public-ui/ActionButton";
import { Container } from "@/components/public-ui/Container";
import { LocaleLink as Link, UiText } from "@/lib/i18n/client";

import styles from "./public-state.module.css";

export default function PublicError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container>
      <section className={styles.state} aria-labelledby="error-title">
        <h1 id="error-title">
          <UiText id="errors.loadTitle" />
        </h1>
        <p>
          <UiText id="errors.loadHelp" />
        </p>
        <div className={styles.actions}>
          <ActionButton type="button" onClick={reset}>
            <UiText id="errors.retry" />
          </ActionButton>
          <Link href="/">
            <UiText id="navigation.home" />
          </Link>
          <Link href="/posts">
            <UiText id="navigation.posts" />
          </Link>
        </div>
      </section>
    </Container>
  );
}
