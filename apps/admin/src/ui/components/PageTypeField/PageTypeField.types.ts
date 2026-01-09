import type { PageType } from "@/ui/shell";

export type PageTypeFieldProps = {
  value: PageType;
  onChange: (value: PageType) => void;
  className?: string;
};
