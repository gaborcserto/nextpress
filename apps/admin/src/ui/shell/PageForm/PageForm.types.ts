import type {
  PageFormValues,
  TagCreateFn,
  TagLoadEntityFn,
  TagLoadOptionsFn,
  TagUpdateEntityFn,
} from "@/lib/content/contracts";

export type PageFormProps = {
  initial: PageFormValues;
  onSubmitAction: (values: PageFormValues) => Promise<void> | void;
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
