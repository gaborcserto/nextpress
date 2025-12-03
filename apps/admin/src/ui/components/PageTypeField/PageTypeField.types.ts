import type { PageType } from "@/ui/layout/PageForm";

export type PageTypeFieldProps = {
  value: PageType;
  onChange: (value: PageType) => void;
  className?: string;
};
