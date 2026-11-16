import type { ContentListResponse } from "@/lib/content/useContentList";

export type PageListItem = {
  id: string;
  type: "PAGE" | "POST";
  status: "DRAFT" | "PUBLISHED";
  slug: string;
  title: string;
  excerpt: string | null;
  updatedAt: string;
};

export type PageListResponse = ContentListResponse;
