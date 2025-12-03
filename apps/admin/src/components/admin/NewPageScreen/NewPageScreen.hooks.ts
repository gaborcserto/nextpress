"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";
import type { PageFormValues } from "@/ui/layout/PageForm";
import { showToast } from "@/ui/utils/toast";

export function useCreatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const createPage = async (values: PageFormValues) => {
    if (!values.title || !values.slug) {
      showToast("Title and slug are required.", "warning");
      return;
    }

    const tagIds =
      values.tags?.map((tag) => tag.id).filter((id): id is string => !!id) ??
      [];

    const { tags: _tags, ...rest } = values;

    const body = {
      ...rest,
      tagIds,
    };

    setSaving(true);
    try {
      const res = await apiFetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        showToast(`Create failed: ${res.status}`, "error");
        return;
      }

      showToast("Page created.", "success");
      router.push("/admin/pages");
    } finally {
      setSaving(false);
    }
  };

  return { saving, createPage };
}
