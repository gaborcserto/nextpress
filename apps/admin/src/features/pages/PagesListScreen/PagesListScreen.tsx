"use client";

import { resolvePageType } from "@nextpress/shared/content";
import useSWR from "swr";

import {
  ContentList,
  type ContentListItem,
} from "@/features/content/ContentList";
import { jsonFetcher } from "@/lib/api";

import { PagePathRowsSchema, resolvePagePath } from "./page-path";
import { usePagesList, useDeletePage } from "./PagesListScreen.hooks";
import { isSystemPage } from "../system-page";

export default function PagesListScreen() {
  const { items, error, isLoading, mutate, pagination, query } = usePagesList();
  const { deletingId, deletePage } = useDeletePage(async () => mutate());
  const { data: pagePaths } = useSWR("/api/admin/page-hierarchy", async (url) =>
    PagePathRowsSchema.parse(await jsonFetcher<unknown>(url)),
  );

  const labels = {
    standard: "Standard Page",
    home: "Home Page",
    posts: "Posts Page",
    gallery: "Gallery Page",
  };
  const mapped: ContentListItem[] = items.map((p) => ({
    id: p.id,
    title: p.title,
    authorName: p.authorName,
    typeLabel: labels[resolvePageType(p.layout ?? "STANDARD")],
    slug: p.slug,
    publicPath:
      resolvePagePath(p.id, pagePaths ?? []) ??
      (p.layout === "HOME"
        ? "/"
        : p.layout === "POSTS" && p.slug === "posts"
          ? "/posts"
          : undefined),
    systemPage: isSystemPage(p.layout, p.slug),
    status: p.status,
    canDelete:
      p.layout !== "HOME" && !(p.layout === "POSTS" && p.slug === "posts"),
    publishedAt: p.publishedAt,
    publicationState: p.publicationState,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    scheduledAt: p.publicationState === "SCHEDULED" ? p.publishedAt : null,
  }));

  return (
    <>
      <ContentList
        heading="Pages"
        createHref="/admin/pages/new"
        createLabel="Create Page"
        editHrefAction={(id) => `/admin/pages/${id}`}
        items={mapped}
        isLoading={isLoading}
        error={error ? "Unable to load pages. Please try again." : undefined}
        pagination={pagination}
        query={query}
        pageTypes={labels}
        onRetryAction={() => void mutate()}
        deletingId={deletingId}
        onDeleteAction={deletePage}
      />
    </>
  );
}
