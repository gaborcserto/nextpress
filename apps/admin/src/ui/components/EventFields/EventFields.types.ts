import type { PageFormValues } from "@/lib/content/contracts";

export type EventFieldsProps = {
  values: PageFormValues;
  onChangeAction: (key: keyof PageFormValues, value: string | null) => void;
};
