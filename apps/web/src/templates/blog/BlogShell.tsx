import Link from "next/link";

import { Container } from "@/components/public-ui/Container";
import { SkipLink } from "@/components/public-ui/SkipLink";

import { BlogNavigation } from "./BlogNavigation";
import styles from "./BlogShell.module.css";
import { BlogWordmark } from "./BlogWordmark";
import { NavigationLink } from "./NavigationLink";

import type { ReactNode } from "react";

type NavigationPage = { slug: string; title: string };

export function BlogShell({
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
    <div className={styles.shell}>
      <SkipLink />
      <header className={styles.header}>
        <Container className={styles.headerContent}>
          <Link className={styles.siteIdentity} href="/" title={siteName}>
            <BlogWordmark siteName={siteName} />
          </Link>
          <BlogNavigation>
            <ul className={styles.navigation}>
              <li>
                <NavigationLink href="/">Home</NavigationLink>
              </li>
              <li>
                <NavigationLink href="/posts">Posts</NavigationLink>
              </li>
              {headerPages.map(({ slug, title }) => (
                <li key={slug}>
                  <NavigationLink href={`/pages/${slug}`}>
                    {title}
                  </NavigationLink>
                </li>
              ))}
            </ul>
          </BlogNavigation>
        </Container>
      </header>
      <main className={styles.main} id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className={styles.footer}>
        <Container className={styles.footerContent}>
          <p>
            <BlogWordmark siteName={siteName} />
          </p>
          {footerPages.length > 0 ? (
            <nav aria-label="Footer">
              <ul className={styles.navigation}>
                {footerPages.map(({ slug, title }) => (
                  <li key={slug}>
                    <NavigationLink href={`/pages/${slug}`}>
                      {title}
                    </NavigationLink>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </Container>
      </footer>
    </div>
  );
}
