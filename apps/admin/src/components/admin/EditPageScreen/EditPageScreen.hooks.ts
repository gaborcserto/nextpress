"use client";

import useSWR from "swr";

import type { EditPageResponse } from "./EditPageScreen.types";
import { apiFetch, jsonFetcher } from "@/lib/api";
import type { PageFormValues } from "@/ui/layout/PageForm";
import { showToast } from "@/ui/utils/toast";

export function useEditPage(id: string) {
  const { data, error, isLoading, mutate } = useSWR<EditPageResponse>(
    id ? `/api/pages/${id}` : null,
    jsonFetcher
  );

  return {
    item: data?.item ?? null,
    isLoading,
    error,
    mutate,
    notFound: !isLoading && !data?.item,
  };
}

export async function updatePage(id: string, values: PageFormValues) {
  const tagIds =
    values.tags?.map((tag) => tag.id).filter((id): id is string => !!id) ??
    [];

  const { tags: _tags, ...rest } = values;

  const body = {
    ...rest,
    tagIds,
  };

  const res = await apiFetch(`/api/pages/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    showToast(`Update failed: ${res.status}`, "error");
    return false;
  }

  showToast("Page updated.", "success");
  return true;
}
