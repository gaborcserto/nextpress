"use client";

import { apiFetch } from "@/lib/api";
import type { PageFormValues } from "@/lib/content/contracts";
import { slateToString } from "@/lib/content/editor";

export type PageDto = {
  type: "PAGE";
  layout: PageFormValues["type"];
  status: PageFormValues["status"];
  slug: string;
  title: string;
  content: string;
  inHeaderMenu: boolean;
  inFooterMenu: boolean;
  tagIds: string[];
};

export function pageValuesToDto(values: PageFormValues): PageDto {
  const tagIds =
    values.tags?.map((tag) => tag.id).filter((id): id is string => !!id) ?? [];

  return {
    type: "PAGE",
    layout: values.type,
    status: values.status,
    slug: values.slug,
    title: values.title,
    content: slateToString(values.content),
    inHeaderMenu: values.inHeaderMenu,
    inFooterMenu: values.inFooterMenu,
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
