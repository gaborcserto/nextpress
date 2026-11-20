import type {
  PageFormValues,
  TagCreateFn,
  TagLoadEntityFn,
  TagLoadOptionsFn,
  TagUpdateEntityFn,
} from "@/lib/content/contracts";
import type { LegacySaveOutcome } from "@/lib/content/legacy-editor";
import type { PrivateEditing } from "@/lib/content/usePrivateDraft";

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
