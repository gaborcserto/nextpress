"use client";

import { apiFetch } from "@/lib/api";
import { slateToString } from "@/lib/content/editor";
import {
  readLegacyUpdateResponse,
  type LegacyUpdate,
} from "@/lib/content/legacy-editor";

import type { PageSchema } from "@nextpress/shared/api-contracts";
import type { z } from "zod";

import type { PostFormValues } from "@/lib/content/contracts";

/**
 * Data Transfer Object used when creating or updating a Post via the API.
 * This represents the normalized, backend-facing shape of PostFormValues.
 */
export type PostDto = z.input<typeof PageSchema>;

/**
 * Convert PostFormValues coming from the UI into a PostDto
 * suitable for API submission.
 *
 * - Extracts tag IDs
 * - Serializes validated rich-content documents
 */
export function postValuesToDto(values: PostFormValues): PostDto {
  return { ...postContentFields(values), status: values.status };
}

function postContentFields(
  values: LegacyUpdate<PostFormValues>,
): Omit<PostDto, "status"> {
  const tagIds =
    values.tags?.map((tag) => tag.id).filter((id): id is string => !!id) ?? [];

  return {
    type: "POST",
    slug: values.slug,
    title: values.title,
    excerpt: slateToString(values.excerpt),
    content: slateToString(values.content),
    tagIds,
    ...(values.publishedAt !== undefined
      ? { publishedAt: values.publishedAt }
      : {}),
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
  values: PostFormValues,
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
  values: LegacyUpdate<PostFormValues>,
  expectedVersion: number,
) {
  const body = {
    ...postContentFields(values),
    status: values.status,
    expectedVersion,
  };

  const res = await apiFetch(`/api/post/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return readLegacyUpdateResponse(res);
}
