"use client";

import { EMPTY_SLATE_VALUE } from "@/features/content/editor/editor";
import { useLegacyEditor } from "@/features/content/editor/useLegacyEditor";

import { createPageApi, updatePageApi } from "../page.client";

import type { PageFormValues } from "@/features/content/editor/contracts";

const EMPTY_INITIAL: PageFormValues = {
  type: "STANDARD",
  status: "DRAFT",
  slug: "",
  title: "",
  content: EMPTY_SLATE_VALUE,
  pageDocument: null,
  cover: null,
  gallery: [],
  tags: [],
  parentId: null,
  inHeaderMenu: false,
  inFooterMenu: false,
};

export function usePageEditor(id?: string) {
  return useLegacyEditor({
    id: id,
    endpoint: "/api/pages",
    listHref: "/admin/pages",
    label: "Page",
    initial: EMPTY_INITIAL,
    create: createPageApi,
    update: updatePageApi,
  });
}
