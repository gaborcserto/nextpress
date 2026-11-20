"use client";

import { EMPTY_SLATE_VALUE } from "@/lib/content/editor";
import { useLegacyEditor } from "@/lib/content/useLegacyEditor";
import { createPageApi, updatePageApi } from "@/lib/services/page.client";

import type { PageFormValues } from "@/lib/content/contracts";

const EMPTY_INITIAL: PageFormValues = {
  type: "STANDARD",
  status: "DRAFT",
  slug: "",
  title: "",
  content: EMPTY_SLATE_VALUE,
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
