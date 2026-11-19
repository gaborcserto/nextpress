"use client";

import { ContentList, type ContentListItem } from "@/ui/components";

import { usePagesList, useDeletePage } from "./PagesListScreen.hooks";

export default function PagesListScreen() {
  const { items, error, isLoading, mutate, pagination } = usePagesList();
  const { deletingId, deletePage } = useDeletePage(async () => mutate());

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
      heading="Pages"
      createHref="/admin/pages/new"
      createLabel="Create Page"
      editHrefAction={(id) => `/admin/pages/${id}`}
      items={mapped}
      isLoading={isLoading}
      error={error ? "Unable to load pages. Please try again." : undefined}
      pagination={pagination}
      onRetryAction={() => void mutate()}
      deletingId={deletingId}
      onDeleteAction={deletePage}
    />
  );
}
