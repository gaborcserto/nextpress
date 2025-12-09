"use client";

import { apiFetch } from "@/lib/api";
import type { PageFormValues } from "@/ui/layout/PageForm";

export type PageDto = Omit<PageFormValues, "tags"> & {
  tagIds: string[];
};

export function pageValuesToDto(values: PageFormValues): PageDto {
  const tagIds =
    values.tags?.map((tag) => tag.id).filter((id): id is string => !!id) ?? [];

  const { tags: _tags, ...rest } = values;

  return {
    ...rest,
    tagIds,
  };
}

export type PageApiResult = {
  ok: boolean;
  status: number;
};

export async function createPageApi(
  values: PageFormValues
): Promise<PageApiResult> {
  const body = pageValuesToDto(values);

  const res = await apiFetch("/api/pages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return { ok: res.ok, status: res.status };
}

export async function updatePageApi(
  id: string,
  values: PageFormValues
): Promise<PageApiResult> {
  const body = pageValuesToDto(values);

  const res = await apiFetch(`/api/pages/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return { ok: res.ok, status: res.status };
}
