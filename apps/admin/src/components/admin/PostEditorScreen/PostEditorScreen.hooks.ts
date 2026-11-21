"use client";

import { EMPTY_SLATE_VALUE } from "@/lib/content/editor";
import { useLegacyEditor } from "@/lib/content/useLegacyEditor";
import { createPostApi, updatePostApi } from "@/lib/services/post.client";

import type { PostFormValues } from "@/lib/content/contracts";

const EMPTY_INITIAL: PostFormValues = {
  status: "DRAFT",
  slug: "",
  title: "",
  excerpt: EMPTY_SLATE_VALUE,
  content: EMPTY_SLATE_VALUE,
  tags: [],
  cover: null,
  pageDocument: null,
  publishedAt: null,
};

export function usePostEditor(postId?: string) {
  return useLegacyEditor({
    id: postId,
    endpoint: "/api/post",
    listHref: "/admin/posts",
    label: "Post",
    initial: EMPTY_INITIAL,
    create: createPostApi,
    update: updatePostApi,
  });
}
