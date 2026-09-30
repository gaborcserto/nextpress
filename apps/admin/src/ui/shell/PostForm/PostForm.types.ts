import type {
  PostFormValues,
  TagCreateFn,
  TagLoadEntityFn,
  TagLoadOptionsFn,
  TagUpdateEntityFn,
  UploadFn,
} from "@/lib/content/contracts";

export type { PostFormValues, PostStatus } from "@/lib/content/contracts";

export type PostFormProps = {
  initial: PostFormValues;
  onSubmitAction: (values: PostFormValues) => Promise<void> | void;
  submitting?: boolean;
  submitLabel?: string;

  /** Optional: alternate storage backend for cover image upload */
  imageUploadAction?: UploadFn;

  /** Async tag search (Taxonomy type = TAG) */
  loadTagOptionsAction: TagLoadOptionsFn;

  /** Create a new tag (Taxonomy type = TAG) */
  createTagAction: TagCreateFn;
  loadEntityTagsAction: TagLoadEntityFn;
  updateEntityTagsAction: TagUpdateEntityFn;

  sidebarTitle?: string;
  sidebarSubtitle?: string;
};
