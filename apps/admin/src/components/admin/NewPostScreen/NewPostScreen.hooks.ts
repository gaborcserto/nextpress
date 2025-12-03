"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";
import type { PostFormValues } from "@/ui/layout/PostForm/PostForm.types";
import { showToast } from "@/ui/utils/toast";

/**
 * Hook to handle creating a new blog post.
 */
export function useCreatePost() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const createPost = async (values: PostFormValues) => {
    if (!values.title || !values.slug) {
      showToast("Title and slug are required.", "warning");
      return;
    }

    const tagIds =
      values.tags?.map((tag) => tag.id).filter((id): id is string => !!id) ?? [];

    setSaving(true);
    try {
      const res = await apiFetch("/api/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Backend uses PageSchema, so we pass the core fields + type="POST".
        body: JSON.stringify({
          type: "POST",
          status: values.status,
          slug: values.slug,
          title: values.title,
          excerpt: values.excerpt,
          content: values.content,
          // Extra fields (tags, cover, publishedAt) can be wired later
          tagIds,
          cover: values.cover,
          publishedAt: values.publishedAt,
        }),
      });

      if (!res.ok) {
        showToast(`Create failed: ${res.status}`, "error");
        return;
      }

      showToast("Post created.", "success");
      router.push("/admin/posts");
    } finally {
      setSaving(false);
    }
  };

  return { saving, createPost };
}
