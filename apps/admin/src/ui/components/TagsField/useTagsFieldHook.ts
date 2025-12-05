"use client";

import { useCallback } from "react";
import useSWR from "swr";

import { jsonFetcher, apiFetch } from "@/lib/api";
import type { TagValue } from "@/ui/components/TagMultiSelect";
import { showToast } from "@/ui/utils/toast";

type ApiResponse = { tags: TagValue[] };

function useTagsFieldHook(resourceUrl: string) {
  const { data, isLoading, mutate } = useSWR<ApiResponse>(
    resourceUrl,
    jsonFetcher
  );

  const selectedTags = data?.tags ?? [];

  const handleChange = useCallback(
    async (nextTags: TagValue[]) => {
      const tagIds = nextTags.map((t) => t.id);
      const previousData = data;

      // optimistic update
      await mutate({ tags: nextTags }, false);

      const res = await apiFetch(resourceUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds }),
      });

      if (!res.ok) {
        // rollback
        if (previousData) {
          await mutate(previousData, false);
        } else {
          await mutate();
        }

        showToast("Tag update failed", "error");
        return;
      }

      // revalidate
      await mutate();
      showToast("Tags updated!", "success");
    },
    [resourceUrl, data, mutate]
  );

  return { selectedTags, isLoading, handleChange };
}

export function usePostTags(postId: string) {
  return useTagsFieldHook(`/api/post/${postId}`);
}

export function usePageTags(pageId: string) {
  return useTagsFieldHook(`/api/pages/${pageId}`);
}
