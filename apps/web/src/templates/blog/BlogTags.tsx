import Link from "next/link";

import navigationStyles from "@/components/public-content/post-list.module.css";
import { TagLinks } from "@/components/public-content/TagLinks";
import { Container } from "@/components/public-ui/Container";
import { getMaxPostsPage } from "@/lib/content/post-archive";

import styles from "./BlogArchive.module.css";
import headingStyles from "./BlogHeading.module.css";

import type { TagIndexProps } from "../types";

export function BlogTags({ tags, hasMore, page, tagsPerPage }: TagIndexProps) {
  return (
    <Container className={styles.archive}>
      <header className={styles.intro}>
        <h1 className={`${headingStyles.heading} ${styles.pageHeading}`}>
          Tags
        </h1>
      </header>
      {tags.length > 0 ? (
        <TagLinks tags={tags} />
      ) : (
        <p>There are no published tags yet.</p>
      )}
      {tags.length > 0 && (page > 1 || hasMore) ? (
        <nav
          className={navigationStyles.archiveNavigation}
          aria-label="Tag index pages"
        >
          {page > 1 ? (
            <Link href={page === 2 ? "/tags" : `/tags?page=${page - 1}`}>
              Previous page
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          <p>
            Page <span aria-current="page">{page}</span>
          </p>
          {hasMore && page < getMaxPostsPage(tagsPerPage) ? (
            <Link href={`/tags?page=${page + 1}`}>Next page</Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      ) : null}
    </Container>
  );
}
