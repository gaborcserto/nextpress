"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";

import type { PageListResponse } from "./PagesListScreen.types";
import { apiFetch, jsonFetcher } from "@/lib/api";
import { showToast } from "@/ui/utils/toast";

export function usePagesList() {
  const { data, isLoading, mutate } = useSWR<PageListResponse>(
    "/api/pages",
    jsonFetcher
  );

  return { items: data?.items ?? [], isLoading, mutate };
}

export function useDeletePage(onDeleted?: () => void) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deletePage = useCallback(
    async (id: string) => {
      if (!confirm("Delete this page?")) return;
      setDeletingId(id);

      try {
        const res = await apiFetch(`/api/pages/${id}`, { method: "DELETE" });
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
    [onDeleted]
  );

  return { deletingId, deletePage };
}
