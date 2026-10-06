"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./post-list.module.css";
import { PostList } from "./PostList";
import { getNextPostBatch } from "@/app/posts/actions";
import { ActionButton } from "@/components/public-ui/ActionButton";
import { getMaxPostsPage } from "@/lib/content/post-archive";
import type { PublicPostSummary } from "@/lib/content/public-content.server";

export function LoadMorePostList({
  posts: initialPosts,
  page: initialPage,
  hasMore: initialHasMore,
  postsPerPage,
}: {
  posts: PublicPostSummary[];
  page: number;
  hasMore: boolean;
  postsPerPage: number;
}) {
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
    if (loading || !canLoadMore) return;
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
        return [...current, ...batch.posts.filter(({ slug }) => !knownSlugs.has(slug))];
      });
      setPage(nextPage);
      setHasMore(batch.hasMore);
      window.history.pushState(null, "", fallbackHref);
      const noun = batch.posts.length === 1 ? "post" : "posts";
      setMessage(`Loaded ${batch.posts.length} more ${noun}. Page ${nextPage}.`);
    } catch {
      setError("Could not load more posts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PostList posts={posts} />
      <nav className={styles.archiveNavigation} aria-label="Post archive pages">
        {page > 1 ? <Link href={page === 2 ? "/posts" : `/posts?page=${page - 1}`}>Previous page</Link> : <span aria-hidden="true" />}
        <p>Page <span aria-current="page">{page}</span></p>
        {canLoadMore && !enhanced ? (
          <Link href={fallbackHref}>Next page</Link>
        ) : canLoadMore ? (
          <ActionButton type="button" disabled={loading} aria-busy={loading} onClick={() => void loadMore()}>
            {loading ? "Loading posts…" : "Load more posts"}
          </ActionButton>
        ) : <span aria-hidden="true" />}
      </nav>
      {message ? <p className={styles.batchStatus} role="status" aria-live="polite">{message}</p> : null}
      {error ? <p className={styles.batchError} role="alert">{error}</p> : null}
    </>
  );
}
