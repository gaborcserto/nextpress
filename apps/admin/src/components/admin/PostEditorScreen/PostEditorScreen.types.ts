import type { PostFormValues } from "@/ui/shell";

export type PostEditorScreenProps = {
  /**
   * When postId is present the screen works in edit mode.
   * When postId is missing the screen works in create mode.
   */
  postId?: string;
};

export type PostDetailResponse = {
  item: PostFormValues;
};
