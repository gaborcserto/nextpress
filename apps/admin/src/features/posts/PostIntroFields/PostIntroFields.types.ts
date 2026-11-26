import type { Descendant } from "slate";

export type PostIntroFieldsProps = {
  disabled?: boolean;
  excerpt: Descendant[];
  onExcerptChangeAction: (value: Descendant[]) => void;
};
