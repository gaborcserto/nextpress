import type { PageType } from "@/features/content/editor/contracts";

export type PageTypeFieldProps = {
  id?: string;
  value: PageType;
  onChange: (value: PageType) => void;
  pageId?: string;
  className?: string;
};
