import type { PostFormValues } from "@/features/content/editor/contracts";
import type { LegacySaveOutcome } from "@/features/content/editor/legacy-editor";
import type { PrivateEditing } from "@/features/content/private-drafts/usePrivateDraft";
import type {
  TagCreateFn,
  TagLoadEntityFn,
  TagLoadOptionsFn,
  TagUpdateEntityFn,
} from "@/features/taxonomy/tag.types";

export type {
  PostFormValues,
  PostStatus,
} from "@/features/content/editor/contracts";

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
