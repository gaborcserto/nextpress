"use client";

import { usePagesList, useDeletePage } from "./PagesListScreen.hooks";
import { ContentList, type ContentListItem } from "@/ui/components";

export default function PagesListScreen() {
  const { items, isLoading, mutate } = usePagesList();
  const { deletingId, deletePage } = useDeletePage(async () => mutate());

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
      heading="Pages"
      createHref="/admin/pages/new"
      createLabel="Create Page"
      editHrefAction={(id) => `/admin/pages/${id}`}
      items={mapped}
      isLoading={isLoading}
      deletingId={deletingId}
      onDeleteAction={deletePage}
    />
  );
}
