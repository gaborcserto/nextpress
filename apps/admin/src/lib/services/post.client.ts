"use client";

import { apiFetch } from "@/lib/api";
import type { PostFormValues } from "@/ui/shell";
import { slateToString } from "@/ui/utils";

/**
 * Data Transfer Object used when creating or updating a Post via the API.
 * This represents the normalized, backend-facing shape of PostFormValues.
 */
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

/**
 * Convert PostFormValues coming from the UI into a PostDto
 * suitable for API submission.
 *
 * - Extracts tag IDs
 * - Serializes Slate values to plain text
 */
export function postValuesToDto(values: PostFormValues): PostDto {
  const tagIds =
    values.tags?.map((tag) => tag.id).filter((id): id is string => !!id) ?? [];

  return {
    type: "POST",
    status: values.status,
    slug: values.slug,
    title: values.title,
    excerpt: values.excerpt ? slateToString(values.excerpt) : null,
    content: slateToString(values.content),
    tagIds,
    cover: values.cover,
    publishedAt: values.publishedAt,
  };
}

/**
 * Minimal API response wrapper used by post create/update calls.
 */
export type PostApiResult = {
  ok: boolean;
  status: number;
};

/**
 * Create a new post via the API.
 */
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

/**
 * Update an existing post by ID via the API.
 */
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
