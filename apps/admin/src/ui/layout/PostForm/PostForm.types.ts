import type { MediaValue, UploadFn } from "@/ui/components/ImageUploader";
import type { TagValue, TagLoadOptionsFn, TagCreateFn } from "@/ui/components/TagMultiSelect";

export type PostStatus = "DRAFT" | "PUBLISHED";

export type PostFormValues = {
  status: PostStatus;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  tags: TagValue[];

  cover: MediaValue | null;
  publishedAt?: string | null; // ISO string (optional)
};

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
};
