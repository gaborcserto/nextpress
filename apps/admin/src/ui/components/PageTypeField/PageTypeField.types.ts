import type { PageType } from "@/lib/content/contracts";

export type PageTypeFieldProps = {
  value: PageType;
  onChange: (value: PageType) => void;
  className?: string;
};
