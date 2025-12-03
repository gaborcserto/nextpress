export type PostListItem = {
  id: string;
  type: "POST";
  status: "DRAFT" | "PUBLISHED";
  slug: string;
  title: string;
  excerpt: string | null;
  updatedAt: string;
  // You can extend with authorName, categories, tags later if API returns them
};

export type PostListResponse = {
  items: PostListItem[];
};
