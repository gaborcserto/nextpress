import type { PageFormValues } from "@/ui/shell";

export type EventFieldsProps = {
  values: PageFormValues;
  onChangeAction: (key: keyof PageFormValues, value: string | null) => void;
};
