"use client";

import Link from "next/link";

import styles from "./public-state.module.css";
import { ActionButton } from "@/components/public-ui/ActionButton";
import { Container } from "@/components/public-ui/Container";

export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container>
      <section className={styles.state} aria-labelledby="error-title">
        <h1 id="error-title">This page could not be loaded</h1>
        <p>Please try again, or continue to another part of the site.</p>
        <div className={styles.actions}>
          <ActionButton type="button" onClick={reset}>Try again</ActionButton>
          <Link href="/">Home</Link>
          <Link href="/posts">Posts</Link>
        </div>
      </section>
    </Container>
  );
}
