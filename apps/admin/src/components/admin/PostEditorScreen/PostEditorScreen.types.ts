export type PostEditorScreenProps = {
  /**
   * When postId is present the screen works in edit mode.
   * When postId is missing the screen works in create mode.
   */
  postId?: string;
};

export type PostDetailItem = {
  id: string;
  type: "POST";
  status: "DRAFT" | "PUBLISHED";
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  publishedAt: string | null;
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
