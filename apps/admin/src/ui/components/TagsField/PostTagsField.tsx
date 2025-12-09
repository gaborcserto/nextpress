"use client";

import TagsField from "./TagsField";
import { usePostTags } from "./useTagsFieldHook";
import type { TagValue } from "@/ui/components/TagMultiSelect";

type Props = { postId: string };

export function PostTagsField({ postId }: Props) {
  const { selectedTags, isLoading, handleChange } = usePostTags(postId);

  const handleChangeVoid = (tags: TagValue[]) => {
    void handleChange(tags);
  };

  return (
    <TagsField
      selectedTags={selectedTags}
      isLoading={isLoading}
      onChangeAction={handleChangeVoid}
    />
  );
}
