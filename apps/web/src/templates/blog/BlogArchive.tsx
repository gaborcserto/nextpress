import { ArchivePageLink } from "@/components/public-content/ArchivePageLink";
import { LoadMorePostList } from "@/components/public-content/LoadMorePostList";
import postListStyles from "@/components/public-content/post-list.module.css";
import { PostList } from "@/components/public-content/PostList";
import { Container } from "@/components/public-ui/Container";
import { getMaxPostsPage } from "@/lib/content/post-archive";
import { UiNav, UiText } from "@/lib/i18n/client";

import styles from "./BlogArchive.module.css";
import headingStyles from "./BlogHeading.module.css";

import type { ArchiveProps } from "../types";

export function BlogArchive({
  title,
  basePath = "/posts",
  pageSlug,
  children,
  posts,
  page,
  hasMore,
  postsPerPage,
  listingMode,
  listVariant,
  previewNavigation,
}: ArchiveProps) {
  const showPagination =
    listingMode === "PAGINATION" && posts.length > 0 && (page > 1 || hasMore);

  return (
    <Container className={styles.archive}>
      <header className={styles.intro}>
        <h1
          id="archive-title"
          className={`${headingStyles.heading} ${styles.pageHeading}`}
        >
          {title ?? <UiText id="navigation.posts" />}
        </h1>
        {children}
      </header>
      <section
        aria-labelledby="archive-list-title"
        data-blog-archive-list
        data-blog-posts-archive
      >
        <h2 className={styles.listHeading} id="archive-list-title">
          <UiText id="posts.published" />
        </h2>
        {listingMode === "LOAD_MORE" && posts.length > 0 ? (
          <LoadMorePostList
            key={`${page}:${posts.map(({ slug }) => slug).join(",")}`}
            basePath={basePath}
            pageSlug={pageSlug}
            posts={posts}
            page={page}
            hasMore={hasMore}
            postsPerPage={postsPerPage}
            variant={listVariant}
            previewNavigation={previewNavigation}
          />
        ) : (
          <PostList posts={posts} variant={listVariant} />
        )}
      </section>
      {showPagination ? (
        <UiNav
          className={postListStyles.archiveNavigation}
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
            <UiText id="pagination.page" />{" "}
            <span aria-current="page">{page}</span>
          </p>
          {hasMore && page < getMaxPostsPage(postsPerPage) ? (
            <ArchivePageLink
              basePath={basePath}
              page={page + 1}
              label="pagination.next"
              previewNavigation={previewNavigation}
            />
          ) : (
            <span aria-hidden="true" />
          )}
        </UiNav>
      ) : null}
    </Container>
  );
}
