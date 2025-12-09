"use client";

import { apiFetch } from "@/lib/api";
import type { PostFormValues } from "@/ui/layout/PostForm/PostForm.types";

export type PostDto = {
  type: "POST";
  status: PostFormValues["status"];
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  tagIds: string[];
  cover: PostFormValues["cover"];
  publishedAt: PostFormValues["publishedAt"];
};

export function postValuesToDto(values: PostFormValues): PostDto {
  const tagIds =
    values.tags?.map((tag) => tag.id).filter((id): id is string => !!id) ?? [];

  return {
    type: "POST",
    status: values.status,
    slug: values.slug,
    title: values.title,
    excerpt: values.excerpt ?? "",
    content: values.content,
    tagIds,
    cover: values.cover,
    publishedAt: values.publishedAt,
  };
}

export type PostApiResult = {
  ok: boolean;
  status: number;
};

export async function createPostApi(
  values: PostFormValues
): Promise<PostApiResult> {
  const body = postValuesToDto(values);

  const res = await apiFetch("/api/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return { ok: res.ok, status: res.status };
}

export async function updatePostApi(
  id: string,
  values: PostFormValues
): Promise<PostApiResult> {
  const body = postValuesToDto(values);

  const res = await apiFetch(`/api/post/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return { ok: res.ok, status: res.status };
}
