import TagsField from "./TagsField";
import { usePageTags } from "./useTagsFieldHook";
import type { TagValue } from "@/ui/components/TagMultiSelect";

type Props = { pageId: string };

export function PageTagsField({ pageId }: Props) {
  const { selectedTags, isLoading, handleChange } = usePageTags(pageId);

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
