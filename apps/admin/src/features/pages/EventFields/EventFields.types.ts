import type { PageFormValues } from "@/features/content/editor/contracts";

export type EventFieldsProps = {
  values: PageFormValues;
  onChangeAction: (key: keyof PageFormValues, value: string | null) => void;
};
