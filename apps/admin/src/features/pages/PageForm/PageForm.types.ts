import type { PageFormValues } from "@/features/content/editor/contracts";
import type { LegacySaveOutcome } from "@/features/content/editor/legacy-editor";
import type { PrivateEditing } from "@/features/content/private-drafts/usePrivateDraft";
import type {
  TagCreateFn,
  TagLoadEntityFn,
  TagLoadOptionsFn,
  TagUpdateEntityFn,
} from "@/features/taxonomy/tag.types";

export type PageFormProps = {
  privateEditing?: PrivateEditing;
  contentId?: string;
  initial: PageFormValues;
  onSubmitAction: (
    values: PageFormValues,
  ) => Promise<LegacySaveOutcome> | LegacySaveOutcome;
  submitting?: boolean;
  submitLabel?: string;

  /** Async tag search (required) */
  loadTagOptionsAction: TagLoadOptionsFn;

  /** Create new tag (required) */
  createTagAction: TagCreateFn;
  loadEntityTagsAction: TagLoadEntityFn;
  updateEntityTagsAction: TagUpdateEntityFn;

  sidebarTitle?: string;
  sidebarSubtitle?: string;
};
