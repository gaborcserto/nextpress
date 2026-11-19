"use client";

import { ContentList, type ContentListItem } from "@/ui/components";

import { usePostsList, useDeletePost } from "./PostsListScreen.hooks";

export default function PostsListScreen() {
  const { items, error, isLoading, mutate, pagination } = usePostsList();
  const { deletingId, deletePost } = useDeletePost(async () => mutate());

  const mapped: ContentListItem[] = items.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    publishedAt: p.publishedAt,
    publicationState: p.publicationState,
    updatedAt: p.updatedAt,
    dateLabel: p.updatedAt ? new Date(p.updatedAt).toLocaleString() : undefined,
  }));

  return (
    <ContentList
      heading="Posts"
      createHref="/admin/posts/new"
      createLabel="Create Post"
      editHrefAction={(id) => `/admin/posts/${id}`}
      items={mapped}
      isLoading={isLoading}
      error={error ? "Unable to load posts. Please try again." : undefined}
      pagination={pagination}
      onRetryAction={() => void mutate()}
      deletingId={deletingId}
      onDeleteAction={deletePost}
    />
  );
}
