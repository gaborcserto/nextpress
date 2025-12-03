"use client";

import { useCallback, useState } from "react";
import useSWR, { type KeyedMutator } from "swr";

import type { PostDetailResponse } from "./EditPostScreen.types";
import { apiFetch, jsonFetcher } from "@/lib/api";
import type { PostFormValues } from "@/ui/layout/PostForm/PostForm.types";
import { showToast } from "@/ui/utils/toast";

/**
 * Load a single post for editing from /api/post/[id].
 */
export function usePostDetail(id: string) {
  const { data, isLoading, error, mutate } = useSWR<PostDetailResponse>(
    id ? `/api/post/${id}` : null,
    jsonFetcher,
  );

  const item = data?.item ?? null;
  const tags = data?.tags ?? [];

  let initial: PostFormValues | null = null;
  if (item) {
    initial = {
      status: item.status,
      slug: item.slug,
      title: item.title,
      excerpt: item.excerpt ?? "",
      content: item.content,
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
      })),
      // TODO: once cover/media is wired, map cover too
      cover: null,
      publishedAt: item.publishedAt
        ? new Date(item.publishedAt).toISOString().slice(0, 16)
        : null,
    };
  }

  return { initial, isLoading, error, mutate };
}

/**
 * Hook to handle updating an existing post.
 */
export function useUpdatePost(
  id: string,
  mutate?: KeyedMutator<PostDetailResponse>
) {
  const [saving, setSaving] = useState(false);

  const updatePost = useCallback(
    async (values: PostFormValues) => {
      if (!values.title || !values.slug) {
        showToast("Title and slug are required.", "warning");
        return;
      }

      const tagIds =
        values.tags?.map((tag) => tag.id).filter((id): id is string => !!id) ??
        [];

      setSaving(true);
      try {
        const res = await apiFetch(`/api/post/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "POST",
            status: values.status,
            slug: values.slug,
            title: values.title,
            excerpt: values.excerpt,
            content: values.content,
            tagIds,
          }),
        });

        if (!res.ok) {
          showToast(`Update failed: ${res.status}`, "error");
          return;
        }

        showToast("Post updated.", "success");
        if (mutate) await mutate();
      } finally {
        setSaving(false);
      }
    },
    [id, mutate],
  );

  return { saving, updatePost };
}
