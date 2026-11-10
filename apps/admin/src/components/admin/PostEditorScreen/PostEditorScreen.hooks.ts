"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { EMPTY_SLATE_VALUE } from "@/lib/content/editor";
import { createPostApi, updatePostApi } from "@/lib/services/post.client";
import { showToast } from "@/ui/utils";

import type { PostFormValues } from "@/lib/content/contracts";

import type { PostDetailResponse } from "./PostEditorScreen.types";

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
  const savingRef = useRef(false);

  const isEdit = !!postId;

  const { data, error, isLoading, mutate } = useSWR<PostDetailResponse>(
    isEdit && postId ? `/api/post/${postId}` : null,
    jsonFetcher,
    // Keep the version tied to the loaded form, not a background revalidation.
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const item: PostFormValues | null = isEdit
    ? (data?.item ?? null)
    : EMPTY_INITIAL;

  const notFound = isEdit && !isLoading && !data?.item;

  const handleSubmit = async (values: PostFormValues): Promise<void> => {
    if (savingRef.current) return;
    if (!values.title || !values.slug) {
      showToast("Title and slug are required.", "warning");

      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      if (postId && data?.item.workingVersion === undefined) {
        showToast("Reload the editor before saving.", "warning");

        return;
      }
      const { ok, status } =
        postId && data
          ? await updatePostApi(postId, values, data.item.workingVersion)
          : await createPostApi(values);

      if (!ok) {
        if (status === 409) {
          showToast(
            "Content changed elsewhere. Your edits are preserved; reload before retrying.",
            "warning",
          );

          return;
        }
        showToast(
          `${isEdit ? "Update failed" : "Create failed"}: ${status}`,
          "error",
        );

        return;
      }

      showToast(isEdit ? "Post updated." : "Post created.", "success");

      if (data) {
        // Advance only our successful write; a GET could return a newer remote edit.
        await mutate(
          { item: { ...values, workingVersion: data.item.workingVersion + 1 } },
          { revalidate: false },
        );
      } else {
        router.push("/admin/posts");
      }
    } catch {
      showToast(
        `Unable to ${isEdit ? "update" : "create"} post. Please try again.`,
        "error",
      );
    } finally {
      savingRef.current = false;
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
