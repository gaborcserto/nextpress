import type { PageType } from "@/lib/content/contracts";

export type PageTypeFieldProps = {
  id?: string;
  value: PageType;
  onChange: (value: PageType) => void;
  className?: string;
};
