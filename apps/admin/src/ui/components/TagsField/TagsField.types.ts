import type { TagValue } from "@/ui/components/TagMultiSelect";

export type TagsFieldProps = {
  /**
   * If provided, the field becomes "managed":
   * - loads existing tags for the entity on mount
   * - persists updates automatically
   */
  entityId?: string;

  /**
   * Controlled value (optional).
   * If you pass `value`, you should also pass `onChange`.
   */
  value?: TagValue[];

  /**
   * Default value for uncontrolled usage.
   * Ignored if `value` is provided.
   */
  defaultValue?: TagValue[];

  /**
   * Called whenever selection changes.
   * Always receives the full TagValue[] list.
   */
  onChangeAction?: (tags: TagValue[]) => void;


  label?: string;
  placeholder?: string;

  /**
   * If true and entityId is provided, automatically persists on change.
   * Defaults to true.
   */
  persist?: boolean;
};
