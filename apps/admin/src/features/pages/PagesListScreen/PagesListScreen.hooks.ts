"use client";

import { useCallback, useRef, useState } from "react";

import { useContentList } from "@/hooks/useContentList";
import { apiFetch } from "@/lib/api";
import { showToast } from "@/ui/utils";

export function usePagesList() {
  return useContentList("/api/pages");
}

export function useDeletePage(onDeleted?: () => void) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletingRef = useRef(false);

  const deletePage = useCallback(
    async (id: string) => {
      if (deletingRef.current) {
        return;
      }

      deletingRef.current = true;
      setDeletingId(id);

      try {
        const res = await apiFetch(`/api/pages/${id}`, { method: "DELETE" });

        if (!res.ok) {
          throw new Error("Unable to delete page. Please try again.");
        }

        showToast("Deleted.", "success");
        await onDeleted?.();
      } catch {
        throw new Error("Unable to delete page. Please try again.");
      } finally {
        deletingRef.current = false;
        setDeletingId(null);
      }
    },
    [onDeleted],
  );

  return { deletingId, deletePage };
}
