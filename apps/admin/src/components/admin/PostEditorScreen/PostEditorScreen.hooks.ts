"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { EMPTY_SLATE_VALUE } from "@/lib/content/editor";
import {
  legacyEditorRevalidation,
  prepareLegacyUpdate,
  reportLegacySaveFailure,
} from "@/lib/content/legacy-editor";
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
    legacyEditorRevalidation,
  );

  const item: PostFormValues | null = isEdit
    ? (data?.item ?? null)
    : EMPTY_INITIAL;

  const notFound = isEdit && !isLoading && !data?.item;

  const handleSubmit = async (values: PostFormValues): Promise<boolean> => {
    if (savingRef.current) {
      return false;
    }

    if (!values.title || !values.slug) {
      showToast("Title and slug are required.", "warning");

      return false;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      if (postId && data?.item.workingVersion === undefined) {
        showToast("Reload the editor before saving.", "warning");

        return false;
      }
      const submittedValues = prepareLegacyUpdate(values, data?.item);
      const { ok, status } =
        postId && data
          ? await updatePostApi(
              postId,
              submittedValues,
              data.item.workingVersion,
            )
          : await createPostApi(values);

      if (!ok) {
        reportLegacySaveFailure(status, isEdit);

        return false;
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

      return true;
    } catch {
      showToast(
        `Unable to ${isEdit ? "update" : "create"} post. Please try again.`,
        "error",
      );

      return false;
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
