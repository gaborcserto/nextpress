import Link from "next/link";

import { LoadMorePostList } from "@/components/public-content/LoadMorePostList";
import postListStyles from "@/components/public-content/post-list.module.css";
import { PostList } from "@/components/public-content/PostList";
import { Container } from "@/components/public-ui/Container";
import { getMaxPostsPage } from "@/lib/content/post-archive";

import styles from "./BlogArchive.module.css";
import headingStyles from "./BlogHeading.module.css";

import type { ArchiveProps } from "../types";

export function BlogArchive({
  title = "Posts",
  basePath = "/posts",
  posts,
  page,
  hasMore,
  postsPerPage,
  listingMode,
  listVariant,
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
          {title}
        </h1>
      </header>
      <section
        aria-labelledby="archive-list-title"
        data-blog-archive-list
        data-blog-posts-archive
      >
        <h2 className={styles.listHeading} id="archive-list-title">
          Published articles
        </h2>
        {listingMode === "LOAD_MORE" && posts.length > 0 ? (
          <LoadMorePostList
            key={`${page}:${posts.map(({ slug }) => slug).join(",")}`}
            posts={posts}
            page={page}
            hasMore={hasMore}
            postsPerPage={postsPerPage}
            variant={listVariant}
          />
        ) : (
          <PostList posts={posts} variant={listVariant} />
        )}
      </section>
      {showPagination ? (
        <nav
          className={postListStyles.archiveNavigation}
          aria-label="Post archive pages"
        >
          {page > 1 ? (
            <Link href={page === 2 ? basePath : `${basePath}?page=${page - 1}`}>
              Previous page
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          <p>
            Page <span aria-current="page">{page}</span>
          </p>
          {hasMore && page < getMaxPostsPage(postsPerPage) ? (
            <Link href={`${basePath}?page=${page + 1}`}>Next page</Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      ) : null}
    </Container>
  );
}
