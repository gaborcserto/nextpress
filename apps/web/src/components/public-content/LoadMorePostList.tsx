"use client";

import { useEffect, useRef, useState } from "react";

import { getNextPostBatch } from "@/app/posts/actions";
import { EditorialArrow } from "@/components/public-ui/EditorialArrow";
import { getMaxPostsPage } from "@/lib/content/post-archive";
import {
  LocaleLink as Link,
  useLocale,
  useMessages,
  UiNav,
  UiText,
} from "@/lib/i18n/client";
import { loadedMessage } from "@/lib/i18n/messages";
import { localizedHref } from "@/lib/i18n/routing";

import styles from "./post-list.module.css";
import { type PostListVariant, PostList } from "./PostList";

import type { PublicPostSummary } from "@/lib/content/public-content.server";

export function LoadMorePostList({
  posts: initialPosts,
  page: initialPage,
  hasMore: initialHasMore,
  postsPerPage,
  variant,
}: {
  posts: PublicPostSummary[];
  page: number;
  hasMore: boolean;
  postsPerPage: number;
  variant: PostListVariant;
}) {
  const text = useMessages();
  const locale = useLocale();
  const navigationRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [enhanced, setEnhanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setEnhanced(true), []);
  useEffect(() => {
    const reloadFromArchiveUrl = () => window.location.reload();
    window.addEventListener("popstate", reloadFromArchiveUrl);

    return () => window.removeEventListener("popstate", reloadFromArchiveUrl);
  }, []);

  const nextPage = page + 1;
  const canLoadMore = hasMore && nextPage <= getMaxPostsPage(postsPerPage);
  const fallbackHref = localizedHref(`/posts?page=${nextPage}`, locale);

  const loadMore = async () => {
    if (loading || !canLoadMore) {
      return;
    }
    const startedWithButtonFocus = document.activeElement === buttonRef.current;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const batch = await getNextPostBatch(nextPage);

      if (!batch) {
        setEnhanced(false);

        return;
      }
      setPosts((current) => {
        const knownSlugs = new Set(current.map(({ slug }) => slug));

        return [
          ...current,
          ...batch.posts.filter(({ slug }) => !knownSlugs.has(slug)),
        ];
      });
      setPage(nextPage);
      if (
        (!batch.hasMore || nextPage >= getMaxPostsPage(postsPerPage)) &&
        startedWithButtonFocus &&
        (document.activeElement === buttonRef.current ||
          document.activeElement === document.body)
      ) {
        navigationRef.current?.focus();
      }
      setHasMore(batch.hasMore);
      window.history.pushState(null, "", fallbackHref);

      setMessage(loadedMessage(locale, batch.posts.length, nextPage));
    } catch {
      setError(text.posts.loadError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PostList posts={posts} variant={variant} />
      {posts.length > 0 && (page > 1 || hasMore) ? (
        <UiNav
          ref={navigationRef}
          tabIndex={-1}
          className={styles.archiveNavigation}
          label="accessibility.postArchivePages"
        >
          {page > 1 ? (
            <Link href={page === 2 ? "/posts" : `/posts?page=${page - 1}`}>
              <UiText id="pagination.previous" />
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          <p>
            <UiText id="pagination.page" />{" "}
            <span aria-current="page">{page}</span>
          </p>
          {canLoadMore && !enhanced && (
            <Link href={fallbackHref}>
              <UiText id="pagination.next" />
            </Link>
          )}
          {canLoadMore && enhanced && (
            <button
              className={styles.loadMoreAction}
              ref={buttonRef}
              type="button"
              disabled={loading}
              aria-busy={loading}
              onClick={() => void loadMore()}
            >
              {loading ? text.posts.loading : text.posts.loadMore}
              <EditorialArrow />
            </button>
          )}
          {!canLoadMore && <span aria-hidden="true" />}
        </UiNav>
      ) : null}
      {message ? (
        <p className={styles.batchStatus} role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className={styles.batchError} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
