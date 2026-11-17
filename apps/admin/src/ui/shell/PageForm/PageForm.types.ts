import type {
  PageFormValues,
  TagCreateFn,
  TagLoadEntityFn,
  TagLoadOptionsFn,
  TagUpdateEntityFn,
} from "@/lib/content/contracts";
import type { PrivateEditing } from "@/lib/content/usePrivateDraft";

export type PageFormProps = {
  privateEditing?: PrivateEditing;
  initial: PageFormValues;
  onSubmitAction: (values: PageFormValues) => Promise<boolean> | boolean;
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
