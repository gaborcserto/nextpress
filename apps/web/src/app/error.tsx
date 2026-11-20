"use client";

import { isServiceUnavailable } from "@nextpress/shared/service-unavailable";

import { ActionButton } from "@/components/public-ui/ActionButton";
import { LocaleLink, UiText } from "@/lib/i18n/client";

import styles from "./not-found.module.css";

export default function PublicError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const unavailable = isServiceUnavailable(error);

  return (
    <main className={styles.page}>
      <section className={styles.content} aria-labelledby="error-title">
        <p className={styles.brand}>
          nextpress<span>.</span>
        </p>
        <p className={styles.code}>{unavailable ? "503" : "500"}</p>
        <h1 id="error-title" className={styles.message}>
          <UiText
            id={unavailable ? "errors.unavailableTitle" : "errors.loadTitle"}
          />
        </h1>
        <p className={styles.description}>
          <UiText
            id={unavailable ? "errors.unavailableHelp" : "errors.loadHelp"}
          />
        </p>
        <div className={styles.navigation}>
          <ActionButton type="button" onClick={retry}>
            <UiText id="errors.retry" />
          </ActionButton>
          <LocaleLink href="/" prefetch={false}>
            <UiText id="navigation.home" />
          </LocaleLink>
          <LocaleLink href="/posts" prefetch={false}>
            <UiText id="navigation.posts" />
          </LocaleLink>
        </div>
      </section>
    </main>
  );
}
