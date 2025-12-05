"use client";

import type { TagsFieldProps } from "./TagsField.types";
import { loadTagOptionsAction, createTagAction } from "@/lib/services/tag.client";
import { TagMultiSelect } from "@/ui/components/TagMultiSelect";


export default function TagsField({
  label = "Tags",
  selectedTags,
  isLoading,
  onChangeAction,
}: TagsFieldProps) {
  if (isLoading) {
    return <div className="loading loading-spinner loading-sm" />;
  }

  return (
    <TagMultiSelect
      label={label}
      value={selectedTags}
      onChangeAction={onChangeAction}
      loadOptionsAction={loadTagOptionsAction}
      createTagAction={createTagAction}
    />
  );
}
