import type { PostFormValues } from "@/features/content/editor/contracts";

export type PostEditorScreenProps = {
  /**
   * When postId is present the screen works in edit mode.
   * When postId is missing the screen works in create mode.
   */
  postId?: string;
};

export type PostDetailResponse = {
  item: PostFormValues & { workingVersion: number };
};
