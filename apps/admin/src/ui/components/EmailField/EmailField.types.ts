import type { InputProps } from "@/ui/primitives";

export type EmailFieldProps = Omit<
  InputProps,
  "type" | "value" | "onChange"
> & {
  id: string;
  value: string;
  onChangeAction: (value: string) => void;
};
