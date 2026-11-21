import { HeaderSearch } from "@/components/public-shell/HeaderSearch";
import { StickyHeader } from "@/components/public-shell/StickyHeader";
import { Container } from "@/components/public-ui/Container";
import { SkipLink } from "@/components/public-ui/SkipLink";
import { LocaleLink as Link, VisitorControls, UiNav } from "@/lib/i18n/client";

import { BlogNavigation } from "./BlogNavigation";
import styles from "./BlogShell.module.css";
import { BlogWordmark } from "./BlogWordmark";
import { MenuTree } from "./MenuTree";

import type { PublicMenuItem } from "@nextpress/shared/api-contracts";
import type { ReactNode } from "react";

type Menus = Record<"header" | "footer" | "sidebar", PublicMenuItem[]>;

const emptyMenus: Menus = { header: [], footer: [], sidebar: [] };

export function BlogShell({
  children,
  siteName,
  menus = emptyMenus,
  supportsSidebar,
}: {
  children: ReactNode;
  siteName: string;
  menus?: Menus;
  supportsSidebar?: boolean;
}) {
  const { header, footer } = menus;
  const sidebar = supportsSidebar ? menus.sidebar : [];
  const main = (
    <main className={styles.main} id="main-content" tabIndex={-1}>
      {children}
    </main>
  );

  return (
    <div className={styles.shell}>
      <SkipLink />
      <span className={styles.stickySentinel} aria-hidden="true" />
      <StickyHeader className={styles.header}>
        <Container className={styles.headerContent}>
          <Link className={styles.siteIdentity} href="/" title={siteName}>
            <BlogWordmark siteName={siteName} />
          </Link>
          <BlogNavigation>
            {header.length > 0 && <MenuTree items={header} dropdown />}
            <HeaderSearch />
            <VisitorControls />
          </BlogNavigation>
        </Container>
      </StickyHeader>
      {sidebar?.length ? (
        <div className={styles.sidebarLayout}>
          {main}
          <aside>
            <UiNav label="accessibility.sidebarNavigation">
              <MenuTree items={sidebar} />
            </UiNav>
          </aside>
        </div>
      ) : (
        main
      )}
      <footer className={styles.footer}>
        <Container className={styles.footerContent}>
          <p>
            <BlogWordmark siteName={siteName} />
          </p>
          {footer.length > 0 && (
            <UiNav label="accessibility.footerNavigation">
              <MenuTree items={footer} />
            </UiNav>
          )}
        </Container>
      </footer>
    </div>
  );
}
