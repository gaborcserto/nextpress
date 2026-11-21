import type {
  PostFormValues,
  TagCreateFn,
  TagLoadEntityFn,
  TagLoadOptionsFn,
  TagUpdateEntityFn,
} from "@/lib/content/contracts";
import type { LegacySaveOutcome } from "@/lib/content/legacy-editor";
import type { PrivateEditing } from "@/lib/content/usePrivateDraft";

export type { PostFormValues, PostStatus } from "@/lib/content/contracts";

export type PostFormProps = {
  privateEditing?: PrivateEditing;
  contentId?: string;
  initial: PostFormValues;
  onSubmitAction: (
    values: PostFormValues,
  ) => Promise<LegacySaveOutcome> | LegacySaveOutcome;
  submitting?: boolean;
  submitLabel?: string;

  /** Async tag search (Taxonomy type = TAG) */
  loadTagOptionsAction: TagLoadOptionsFn;

  /** Create a new tag (Taxonomy type = TAG) */
  createTagAction: TagCreateFn;
  loadEntityTagsAction: TagLoadEntityFn;
  updateEntityTagsAction: TagUpdateEntityFn;

  sidebarTitle?: string;
  sidebarSubtitle?: string;
};
