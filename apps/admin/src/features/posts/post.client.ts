"use client";

import { slateToString } from "@/features/content/editor/editor";
import {
  readLegacyUpdateResponse,
  type LegacyUpdate,
} from "@/features/content/editor/legacy-editor";
import { apiFetch } from "@/lib/api";

import type { PageSchema } from "@nextpress/shared/api-contracts";
import type { WorkingPatch } from "@nextpress/shared/working-aggregate";
import type { z } from "zod";

import type { PostFormValues } from "@/features/content/editor/contracts";

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
function postValuesToDto(values: PostFormValues): PostDto {
  return { ...postContentFields(values), status: values.status };
}

export function postWorkingPatch(values: PostFormValues): WorkingPatch {
  const dto = postValuesToDto(values);

  return {
    title: dto.title,
    slug: dto.slug,
    content: dto.content,
    tagIds: dto.tagIds,
    excerpt: dto.excerpt,
  };
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
    coverId:
      values.cover === undefined ? undefined : (values.cover?.id ?? null),
    pageDocument: values.pageDocument ?? undefined,
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
