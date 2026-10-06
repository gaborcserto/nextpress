"use client";

import { apiFetch } from "@/lib/api";
import type { PostFormValues } from "@/lib/content/contracts";
import { slateToString } from "@/lib/content/editor";

/**
 * Data Transfer Object used when creating or updating a Post via the API.
 * This represents the normalized, backend-facing shape of PostFormValues.
 */
export type PostDto = {
  type: "POST";
  status: PostFormValues["status"];
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  tagIds: string[];
  publishedAt: PostFormValues["publishedAt"];
};

/**
 * Convert PostFormValues coming from the UI into a PostDto
 * suitable for API submission.
 *
 * - Extracts tag IDs
 * - Serializes validated rich-content documents
 */
export function postValuesToDto(values: PostFormValues): PostDto {
  const tagIds =
    values.tags?.map((tag) => tag.id).filter((id): id is string => !!id) ?? [];

  return {
    type: "POST",
    status: values.status,
    slug: values.slug,
    title: values.title,
    excerpt: slateToString(values.excerpt),
    content: slateToString(values.content),
    tagIds,
    publishedAt: values.publishedAt ?? null,
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
