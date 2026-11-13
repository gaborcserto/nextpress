import navigationStyles from "@/components/public-content/post-list.module.css";
import { TagLinks } from "@/components/public-content/TagLinks";
import { Container } from "@/components/public-ui/Container";
import { getMaxPostsPage } from "@/lib/content/post-archive";
import { LocaleLink as Link, UiNav, UiText } from "@/lib/i18n/client";

import styles from "./BlogArchive.module.css";
import headingStyles from "./BlogHeading.module.css";

import type { TagIndexProps } from "../types";

export function BlogTags({ tags, hasMore, page, tagsPerPage }: TagIndexProps) {
  return (
    <Container className={styles.archive}>
      <header className={styles.intro}>
        <h1 className={`${headingStyles.heading} ${styles.pageHeading}`}>
          <UiText id="taxonomy.tags" />
        </h1>
      </header>
      {tags.length > 0 ? (
        <TagLinks tags={tags} />
      ) : (
        <p>
          <UiText id="taxonomy.emptyTags" />
        </p>
      )}
      {tags.length > 0 && (page > 1 || hasMore) ? (
        <UiNav
          className={navigationStyles.archiveNavigation}
          label="accessibility.tagIndexPages"
        >
          {page > 1 ? (
            <Link href={page === 2 ? "/tags" : `/tags?page=${page - 1}`}>
              <UiText id="pagination.previous" />
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          <p>
            <UiText id="pagination.page" />{" "}
            <span aria-current="page">{page}</span>
          </p>
          {hasMore && page < getMaxPostsPage(tagsPerPage) ? (
            <Link href={`/tags?page=${page + 1}`}>
              <UiText id="pagination.next" />
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </UiNav>
      ) : null}
    </Container>
  );
}
