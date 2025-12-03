import type { PageFormValues } from "@/ui/layout/PageForm";

export type EventFieldsProps = {
  values: PageFormValues;
  onChangeAction: (key: keyof PageFormValues, value: string | null) => void;
};
