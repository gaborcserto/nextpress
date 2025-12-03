/**
 * Shape of the API response from GET /api/post/[id].
 * We only type the fields we actually use.
 */
export type PostDetailItem = {
  id: string;
  type: "POST";
  status: "DRAFT" | "PUBLISHED";
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  publishedAt: string | null; // ISO string
};

export type PostDetailTag = {
  id: string;
  name: string;
  slug: string;
};

export type PostDetailResponse = {
  item: PostDetailItem;
  tags: PostDetailTag[];
};
