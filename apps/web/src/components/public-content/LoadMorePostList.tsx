"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { getNextPostBatch } from "@/app/posts/actions";
import { EditorialArrow } from "@/components/public-ui/EditorialArrow";
import { getMaxPostsPage } from "@/lib/content/post-archive";
import { useLocale, useMessages, UiNav, UiText } from "@/lib/i18n/client";
import { loadedMessage } from "@/lib/i18n/messages";
import { localizedHref } from "@/lib/i18n/routing";

import { ArchivePageLink } from "./ArchivePageLink";
import styles from "./post-list.module.css";
import { type PostListVariant, PostList } from "./PostList";

import type { PublicPostSummary } from "@/lib/content/public-content.server";
import type { PreviewArchiveNavigation } from "@/templates/types";

// The server snapshot keeps progressive navigation available until hydration completes.
function subscribeToHydration() {
  return () => {};
}

export function LoadMorePostList({
  posts: initialPosts,
  page: initialPage,
  hasMore: initialHasMore,
  postsPerPage,
  variant,
  basePath = "/posts",
  pageSlug,
  previewNavigation,
}: {
  posts: PublicPostSummary[];
  page: number;
  hasMore: boolean;
  postsPerPage: number;
  variant: PostListVariant;
  basePath?: string;
  pageSlug?: string;
  previewNavigation?: PreviewArchiveNavigation;
}) {
  const text = useMessages();
  const locale = useLocale();
  const navigationRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [enhancementFailed, setEnhancementFailed] = useState(false);
  const enhanced = hydrated && !enhancementFailed;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (previewNavigation) {
      return;
    }

    const reloadFromArchiveUrl = () => window.location.reload();
    window.addEventListener("popstate", reloadFromArchiveUrl);

    return () => window.removeEventListener("popstate", reloadFromArchiveUrl);
  }, [previewNavigation]);

  const nextPage = page + 1;
  const canLoadMore = hasMore && nextPage <= getMaxPostsPage(postsPerPage);
  const fallbackHref = localizedHref(`${basePath}?page=${nextPage}`, locale);

  const loadMore = async () => {
    if (loading || !canLoadMore) {
      return;
    }

    const startedWithButtonFocus = document.activeElement === buttonRef.current;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const loadPage =
        previewNavigation?.loadPage ??
        ((number: number) =>
          pageSlug
            ? getNextPostBatch(number, pageSlug)
            : getNextPostBatch(number));

      const batch = await loadPage(nextPage);

      if (!batch) {
        setEnhancementFailed(true);

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

      if (!previewNavigation) {
        window.history.pushState(null, "", fallbackHref);
      }

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
          {canLoadMore && !enhanced && (
            <ArchivePageLink
              basePath={basePath}
              page={nextPage}
              label="pagination.next"
              previewNavigation={previewNavigation}
            />
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
