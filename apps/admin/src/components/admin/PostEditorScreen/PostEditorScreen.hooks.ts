"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import type { PostDetailResponse } from "./PostEditorScreen.types";
import { jsonFetcher } from "@/lib/api";
import { createPostApi, updatePostApi } from "@/lib/services/post.client";
import { EMPTY_SLATE_VALUE } from "@/ui/components/SlateEditor";
import type { PostFormValues } from "@/ui/layout/PostForm/PostForm.types";
import { showToast } from "@/ui/utils/toast";

const EMPTY_INITIAL: PostFormValues = {
  status: "DRAFT",
  slug: "",
  title: "",
  excerpt: EMPTY_SLATE_VALUE,
  content: EMPTY_SLATE_VALUE,
  tags: [],
  cover: null,
  publishedAt: null,
};

export function usePostEditor(postId?: string) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const isEdit = !!postId;

  const { data, error, isLoading, mutate } = useSWR<PostDetailResponse>(
    isEdit && postId ? `/api/post/${postId}` : null,
    jsonFetcher
  );

  const item: PostFormValues | null = isEdit
    ? data?.item ?? null
    : EMPTY_INITIAL;

  const notFound = isEdit && !isLoading && !data?.item;

  const handleSubmit = async (values: PostFormValues): Promise<void> => {
    if (!values.title || !values.slug) {
      showToast("Title and slug are required.", "warning");
      return;
    }

    setSaving(true);
    try {
      const { ok, status } = isEdit
        ? await updatePostApi(postId!, values)
        : await createPostApi(values);

      if (!ok) {
        showToast(
          `${isEdit ? "Update failed" : "Create failed"}: ${status}`,
          "error"
        );
        return;
      }

      showToast(isEdit ? "Post updated." : "Post created.", "success");

      if (isEdit) {
        await mutate();
      } else {
        router.push("/admin/posts");
      }
    } finally {
      setSaving(false);
    }
  };

  return {
    isEdit,
    item,
    isLoading,
    notFound,
    saving,
    error,
    handleSubmit,
  };
}
