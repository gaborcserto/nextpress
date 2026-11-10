"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { EMPTY_SLATE_VALUE } from "@/lib/content/editor";
import { createPageApi, updatePageApi } from "@/lib/services/page.client";
import { showToast } from "@/ui/utils";

import type { PageFormValues } from "@/lib/content/contracts";

import type { EditPageResponse } from "./PageEditorScreen.types";

const EMPTY_INITIAL: PageFormValues = {
  type: "STANDARD",
  status: "DRAFT",
  slug: "",
  title: "",
  content: EMPTY_SLATE_VALUE,
  tags: [],
  parentId: null,
  inHeaderMenu: false,
  inFooterMenu: false,
};

export function usePageEditor(id?: string) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const isEdit = !!id;

  const { data, error, isLoading, mutate } = useSWR<EditPageResponse>(
    isEdit && id ? `/api/pages/${id}` : null,
    jsonFetcher,
    // Keep the version tied to the loaded form, not a background revalidation.
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const item: PageFormValues | null = isEdit
    ? (data?.item ?? null)
    : EMPTY_INITIAL;
  const notFound = isEdit && !isLoading && !data?.item;

  // Note: returns Promise<void> to match PageForm onSubmitAction type
  const handleSubmit = async (values: PageFormValues): Promise<void> => {
    if (savingRef.current) return;
    if (!values.title || !values.slug) {
      showToast("Title and slug are required.", "warning");

      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      if (id && data?.item.workingVersion === undefined) {
        showToast("Reload the editor before saving.", "warning");

        return;
      }
      const { ok, status } =
        id && data
          ? await updatePageApi(id, values, data.item.workingVersion)
          : await createPageApi(values);

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

      showToast(isEdit ? "Page updated." : "Page created.", "success");

      if (data) {
        // Advance only our successful write; a GET could return a newer remote edit.
        await mutate(
          { item: { ...values, workingVersion: data.item.workingVersion + 1 } },
          { revalidate: false },
        );
      } else {
        router.push("/admin/pages");
      }
    } catch {
      showToast(
        `Unable to ${isEdit ? "update" : "create"} page. Please try again.`,
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
