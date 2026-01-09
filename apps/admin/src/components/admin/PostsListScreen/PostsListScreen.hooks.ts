"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";

import type { PostListResponse } from "./PostsListScreen.types";
import { apiFetch, jsonFetcher } from "@/lib/api";
import { showToast } from "@/ui/utils";

/**
 * Load paginated list of posts from /api/post.
 */
export function usePostsList() {
  const { data, isLoading, mutate } = useSWR<PostListResponse>(
    "/api/post",
    jsonFetcher,
  );

  return { items: data?.items ?? [], isLoading, mutate };
}

/**
 * Delete a single post by id via /api/post/[id].
 */
export function useDeletePost(onDeleted?: () => void) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deletePost = useCallback(
    async (id: string) => {
      if (!confirm("Delete this post?")) return;
      setDeletingId(id);

      try {
        const res = await apiFetch(`/api/post/${id}`, { method: "DELETE" });
        const text = await res.text().catch(() => "");

        if (!res.ok) {
          showToast(text || `Request failed: ${res.status}`, "error");
          return;
        }

        showToast("Deleted.", "success");
        onDeleted?.();
      } finally {
        setDeletingId(null);
      }
    },
    [onDeleted],
  );

  return { deletingId, deletePost };
}
