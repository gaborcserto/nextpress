"use client";

type OptionValue = string | number;

type SelectOption = {
  value: OptionValue;
  label: string;
  disabled?: boolean;
};

export type SelectProps = {
  label?: string;
  hint?: string;
  error?: string;
  id?: string;
  fullWidth?: boolean;

  value?: OptionValue;
  defaultValue?: OptionValue;
  name?: string;
  required?: boolean;
  options: readonly SelectOption[];

  placeholder?: string;

  onChangeAction?: (value: string) => void;

  className?: string;
  disabled?: boolean;
};
