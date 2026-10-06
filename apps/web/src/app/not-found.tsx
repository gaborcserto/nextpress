import Link from "next/link";

import styles from "./public-state.module.css";
import { Container } from "@/components/public-ui/Container";

export default function NotFound() {
  return (
    <Container>
      <section className={styles.state} aria-labelledby="not-found-title">
        <h1 id="not-found-title">Page not found</h1>
        <p>This page is unavailable.</p>
        <nav className={styles.actions} aria-label="Recovery">
          <Link href="/">Home</Link>
          <Link href="/posts">Posts</Link>
        </nav>
      </section>
    </Container>
  );
}
