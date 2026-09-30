"use client";

import { usePostsList, useDeletePost } from "./PostsListScreen.hooks";
import { ContentList, type ContentListItem } from "@/ui/components";

export default function PostsListScreen() {
  const { items, isLoading, mutate } = usePostsList();
  const { deletingId, deletePost } = useDeletePost(async () => mutate());

  const mapped: ContentListItem[] = items.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    dateLabel:
      p.status === "PUBLISHED"
        ? `Published: ${new Date(p.updatedAt).toLocaleString()}`
        : `Last modified: ${new Date(p.updatedAt).toLocaleString()}`,
  }));

  return (
    <ContentList
      heading="Posts"
      createHref="/admin/posts/new"
      createLabel="Create Post"
      editHrefAction={(id) => `/admin/posts/${id}`}
      items={mapped}
      isLoading={isLoading}
      deletingId={deletingId}
      onDeleteAction={deletePost}
    />
  );
}
