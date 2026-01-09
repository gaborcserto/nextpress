import type { InputProps } from "@/ui/primitives";

export type PasswordFieldProps = Omit<InputProps, "type" | "value" | "onChange"> & {
  id: string;
  value: string;
  onChangeAction: (value: string) => void;
};
