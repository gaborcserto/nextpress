import Link from "next/link";

import styles from "./PublicShell.module.css";
import { Container } from "@/components/public-ui/Container";
import { SkipLink } from "@/components/public-ui/SkipLink";
import type { ReactNode } from "react";

type NavigationPage = { slug: string; title: string };

export function PublicShell({
  children,
  siteName,
  headerPages = [],
  footerPages = [],
}: {
  children: ReactNode;
  siteName: string;
  headerPages?: NavigationPage[];
  footerPages?: NavigationPage[];
}) {
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
              <li>
                <Link href="/posts">Posts</Link>
              </li>
              {headerPages.map(({ slug, title }) => (
                <li key={slug}><Link href={`/pages/${slug}`}>{title}</Link></li>
              ))}
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
          {footerPages.length > 0 ? (
            <nav aria-label="Footer">
              <ul className={styles.navigation}>
                {footerPages.map(({ slug, title }) => (
                  <li key={slug}><Link href={`/pages/${slug}`}>{title}</Link></li>
                ))}
              </ul>
            </nav>
          ) : null}
        </Container>
      </footer>
    </>
  );
}
