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

  value: OptionValue | "";
  options: readonly SelectOption[];

  placeholder?: string;

  onChangeAction?: (value: OptionValue | "") => void;

  className?: string;
  disabled?: boolean;
};
