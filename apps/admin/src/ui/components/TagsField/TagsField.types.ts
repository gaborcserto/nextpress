import type { TagValue } from "@/ui/components/TagMultiSelect";

export type TagsFieldProps = {
  label?: string;
  selectedTags: TagValue[];
  isLoading: boolean;
  onChangeAction: (tags: TagValue[]) => void;
};
