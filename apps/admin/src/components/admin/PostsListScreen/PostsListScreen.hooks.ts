"use client";

import { useCallback, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useContentList } from "@/lib/content/useContentList";
import { showToast } from "@/ui/utils";

import { fetchPostList, PostListResponseError } from "./postListFetcher";

function shouldRetryPostList(error: Error) {
  return !(error instanceof PostListResponseError);
}

/**
 * Load paginated list of posts from /api/post.
 */
export function usePostsList() {
  return useContentList("/api/post", fetchPostList, shouldRetryPostList);
}

/**
 * Delete a single post by id via /api/post/[id].
 */
export function useDeletePost(onDeleted?: () => void) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletingRef = useRef(false);

  const deletePost = useCallback(
    async (id: string) => {
      if (deletingRef.current) {
        return;
      }
      deletingRef.current = true;
      setDeletingId(id);

      try {
        const res = await apiFetch(`/api/post/${id}`, { method: "DELETE" });

        if (!res.ok) {
          throw new Error("Unable to delete post. Please try again.");
        }

        showToast("Deleted.", "success");
        await onDeleted?.();
      } catch {
        throw new Error("Unable to delete post. Please try again.");
      } finally {
        deletingRef.current = false;
        setDeletingId(null);
      }
    },
    [onDeleted],
  );

  return { deletingId, deletePost };
}
