import { HeaderSearch } from "@/components/public-shell/HeaderSearch";
import { StickyHeader } from "@/components/public-shell/StickyHeader";
import { VisitorControls } from "@/components/public-shell/VisitorControls";
import { Container } from "@/components/public-ui/Container";
import { SkipLink } from "@/components/public-ui/SkipLink";
import { LocaleLink as Link, UiNav } from "@/lib/i18n/client";

import styles from "./BlogShell.module.css";
import { BlogWordmark } from "../BlogWordmark";
import { BlogNavigation } from "../navigation/BlogNavigation";
import { MenuTree } from "../navigation/MenuTree";

import type { ShellProps } from "../../types";

const emptyMenus: NonNullable<ShellProps["menus"]> = {
  header: [],
  footer: [],
  sidebar: [],
};

export function BlogShell({
  children,
  siteName,
  menus = emptyMenus,
  supportsSidebar,
}: ShellProps) {
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
              <MenuTree items={sidebar} dropdown />
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
              <MenuTree items={footer} dropdown />
            </UiNav>
          )}
        </Container>
      </footer>
    </div>
  );
}
