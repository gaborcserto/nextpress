import Link from "next/link";

import styles from "./PublicShell.module.css";
import { Container } from "@/components/public-ui/Container";
import { SkipLink } from "@/components/public-ui/SkipLink";
import type { ReactNode } from "react";


const siteName = "NextPress";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <header className={styles.header}>
        <Container className={styles.headerContent}>
          <Link className={styles.siteIdentity} href="/">
            {siteName}
          </Link>
          <nav aria-label="Primary">
            <ul className={styles.navigation}>
              <li>
                <Link href="/">Home</Link>
              </li>
            </ul>
          </nav>
        </Container>
      </header>
      <main className={styles.main} id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className={styles.footer}>
        <Container>
          <p>{siteName}</p>
        </Container>
      </footer>
    </>
  );
}
