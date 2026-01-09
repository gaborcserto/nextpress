import type { PageFormValues } from "@/ui/shell";

export type PageEditorScreenProps = {
  /**
   * When id is present the screen works in edit mode.
   * When id is missing the screen works in create mode.
   */
  id?: string;
};

export type EditPageResponse = {
  item: PageFormValues;
};
