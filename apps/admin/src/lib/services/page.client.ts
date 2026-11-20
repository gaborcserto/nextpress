"use client";

import { apiFetch } from "@/lib/api";
import { slateToString } from "@/lib/content/editor";
import {
  readLegacyUpdateResponse,
  type LegacyUpdate,
} from "@/lib/content/legacy-editor";

import type { PageSchema } from "@nextpress/shared/api-contracts";
import type { z } from "zod";

import type { PageFormValues } from "@/lib/content/contracts";

export type PageDto = z.input<typeof PageSchema>;

export function pageValuesToDto(values: PageFormValues): PageDto {
  return { ...pageContentFields(values), status: values.status };
}

function pageContentFields(
  values: LegacyUpdate<PageFormValues>,
): Omit<PageDto, "status"> {
  const tagIds =
    values.tags?.map((tag) => tag.id).filter((id): id is string => !!id) ?? [];

  return {
    type: "PAGE",
    layout: values.type,
    ...(values.publishedAt !== undefined
      ? { publishedAt: values.publishedAt }
      : {}),
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
  values: PageFormValues,
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
  values: LegacyUpdate<PageFormValues>,
  expectedVersion: number,
) {
  const body = {
    ...pageContentFields(values),
    status: values.status,
    expectedVersion,
  };

  const res = await apiFetch(`/api/pages/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return readLegacyUpdateResponse(res);
}
