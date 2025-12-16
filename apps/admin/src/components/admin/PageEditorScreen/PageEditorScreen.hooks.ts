"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import type { EditPageResponse } from "./PageEditorScreen.types";
import { jsonFetcher } from "@/lib/api";
import { createPageApi, updatePageApi } from "@/lib/services/page.client";
import type { PageFormValues } from "@/ui/layout/PageForm";
import { showToast } from "@/ui/utils/toast";

const EMPTY_INITIAL: PageFormValues = {
  type: "STANDARD",
  status: "DRAFT",
  slug: "",
  title: "",
  content: "",
  tags: [],
  parentId: null,
  inHeaderMenu: false,
  inFooterMenu: false,
};

export function usePageEditor(id?: string) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const isEdit = !!id;

  const { data, error, isLoading, mutate } = useSWR<EditPageResponse>(
    isEdit && id ? `/api/pages/${id}` : null,
    jsonFetcher
  );

  const item: PageFormValues | null = isEdit ? data?.item ?? null : EMPTY_INITIAL;
  const notFound = isEdit && !isLoading && !data?.item;

  // Note: returns Promise<void> to match PageForm onSubmitAction type
  const handleSubmit = async (values: PageFormValues): Promise<void> => {
    if (!values.title || !values.slug) {
      showToast("Title and slug are required.", "warning");
      return;
    }

    setSaving(true);
    try {
      const { ok, status } = isEdit
        ? await updatePageApi(id!, values)
        : await createPageApi(values);

      if (!ok) {
        showToast(
          `${isEdit ? "Update failed" : "Create failed"}: ${status}`,
          "error"
        );
        return;
      }

      showToast(isEdit ? "Page updated." : "Page created.", "success");

      if (isEdit) {
        await mutate();
      } else {
        router.push("/admin/pages");
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
