import { UiNav, UiText } from "@/lib/i18n/client";

import { ArchivePageLink } from "./ArchivePageLink";
import styles from "./post-list.module.css";

import type { ReactNode, Ref } from "react";

import type { PreviewArchiveNavigation } from "@/templates/types";

export function PostArchivePagination({
  basePath,
  page,
  previewNavigation,
  children,
  navRef,
  tabIndex,
}: {
  basePath: string;
  page: number;
  previewNavigation?: PreviewArchiveNavigation;
  children: ReactNode;
  navRef?: Ref<HTMLElement>;
  tabIndex?: number;
}) {
  return (
    <UiNav
      ref={navRef}
      tabIndex={tabIndex}
      className={styles.archiveNavigation}
      label="accessibility.postArchivePages"
    >
      {page > 1 ? (
        <ArchivePageLink
          basePath={basePath}
          page={page - 1}
          label="pagination.previous"
          previewNavigation={previewNavigation}
        />
      ) : (
        <span aria-hidden="true" />
      )}
      <p>
        <UiText id="pagination.page" /> <span aria-current="page">{page}</span>
      </p>
      {children}
    </UiNav>
  );
}
