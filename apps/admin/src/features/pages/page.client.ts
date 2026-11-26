"use client";

import { pageLayouts } from "@nextpress/shared/content";

import { slateToString } from "@/features/content/editor/editor";
import {
  readContentConflict,
  readLegacyUpdateResponse,
  type LegacyUpdate,
} from "@/features/content/editor/legacy-editor";
import { apiFetch } from "@/lib/api";

import type { PageSchema } from "@nextpress/shared/api-contracts";
import type { WorkingPatch } from "@nextpress/shared/working-aggregate";
import type { z } from "zod";

import type { PageFormValues } from "@/features/content/editor/contracts";

export type PageDto = z.input<typeof PageSchema>;

export function pageValuesToDto(values: PageFormValues): PageDto {
  return { ...pageContentFields(values), status: values.status };
}

export function pageWorkingPatch(values: PageFormValues): WorkingPatch {
  const dto = pageValuesToDto(values);

  return {
    title: dto.title,
    slug: dto.slug,
    content: dto.content,
    tagIds: dto.tagIds,
    layout: values.type,
    ...(dto.listingTaxonomyId !== undefined
      ? { listingTaxonomyId: dto.listingTaxonomyId }
      : {}),
    inHeaderMenu: values.inHeaderMenu,
    inFooterMenu: values.inFooterMenu,
  };
}

function pageContentFields(
  values: LegacyUpdate<PageFormValues>,
): Omit<PageDto, "status"> {
  const tagIds =
    values.tags?.map((tag) => tag.id).filter((id): id is string => !!id) ?? [];

  return {
    type: "PAGE",
    layout: values.type,
    coverId:
      values.cover === undefined ? undefined : (values.cover?.id ?? null),
    pageDocument: values.pageDocument ?? undefined,
    ...(values.type === pageLayouts.gallery && values.gallery
      ? { galleryIds: values.gallery.map(({ id }) => id) }
      : {}),
    ...(values.type === pageLayouts.posts
      ? { listingTaxonomyId: values.listingTaxonomyId }
      : {}),
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
  message?: string;
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

  return {
    ok: res.ok,
    status: res.status,
    message: await readContentConflict(res),
  };
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
