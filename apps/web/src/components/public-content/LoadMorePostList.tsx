"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getNextPostBatch } from "@/app/posts/actions";
import { ActionButton } from "@/components/public-ui/ActionButton";
import { getMaxPostsPage } from "@/lib/content/post-archive";

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
  const fallbackHref = `/posts?page=${nextPage}`;

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
      const noun = batch.posts.length === 1 ? "post" : "posts";
      setMessage(
        `Loaded ${batch.posts.length} more ${noun}. Page ${nextPage}.`,
      );
    } catch {
      setError("Could not load more posts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PostList posts={posts} variant={variant} />
      {posts.length > 0 && (page > 1 || hasMore) ? (
        <nav
          ref={navigationRef}
          tabIndex={-1}
          className={styles.archiveNavigation}
          aria-label="Post archive pages"
        >
          {page > 1 ? (
            <Link href={page === 2 ? "/posts" : `/posts?page=${page - 1}`}>
              Previous page
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          <p>
            Page <span aria-current="page">{page}</span>
          </p>
          {canLoadMore && !enhanced && (
            <Link href={fallbackHref}>Next page</Link>
          )}
          {canLoadMore && enhanced && (
            <ActionButton
              ref={buttonRef}
              type="button"
              disabled={loading}
              aria-busy={loading}
              onClick={() => void loadMore()}
            >
              {loading ? "Loading posts…" : "Load more posts"}
            </ActionButton>
          )}
          {!canLoadMore && <span aria-hidden="true" />}
        </nav>
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
