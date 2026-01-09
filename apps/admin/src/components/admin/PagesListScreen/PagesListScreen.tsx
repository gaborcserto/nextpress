"use client";

import { usePagesList, useDeletePage } from "./PagesListScreen.hooks";
import { ContentList, type ContentListItem } from "@/ui/components";

/**
 * Admin page for listing and managing pages.
 */
export default function PagesListScreen() {
  const { items, isLoading, mutate } = usePagesList();
  const { deletingId, deletePage } = useDeletePage(async () => mutate());

  // Map API items to generic ContentList items
  const mapped: ContentListItem[] = items.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    // author could be added later if API returns it
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
      // set showAuthor/showCategories/showTags when you have those fields
    />
  );
}
