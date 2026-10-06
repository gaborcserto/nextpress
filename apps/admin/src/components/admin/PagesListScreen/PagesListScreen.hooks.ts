"use client";

import { useCallback, useRef, useState } from "react";
import useSWR from "swr";

import type { PageListResponse } from "./PagesListScreen.types";
import { apiFetch, jsonFetcher } from "@/lib/api";
import { showToast } from "@/ui/utils";

export function usePagesList() {
  const { data, error, isLoading, mutate } = useSWR<PageListResponse>(
    "/api/pages",
    jsonFetcher
  );

  return { items: data?.items ?? [], error, isLoading, mutate };
}

export function useDeletePage(onDeleted?: () => void) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletingRef = useRef(false);

  const deletePage = useCallback(
    async (id: string) => {
      if (deletingRef.current) return;
      deletingRef.current = true;
      setDeletingId(id);

      try {
        const res = await apiFetch(`/api/pages/${id}`, { method: "DELETE" });
        const text = await res.text().catch(() => "");

        if (!res.ok) {
          showToast(text || `Request failed: ${res.status}`, "error");
          return;
        }

        showToast("Deleted.", "success");
        await onDeleted?.();
      } catch {
        showToast("Unable to delete page. Please try again.", "error");
      } finally {
        deletingRef.current = false;
        setDeletingId(null);
      }
    },
    [onDeleted]
  );

  return { deletingId, deletePage };
}
