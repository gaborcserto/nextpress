export type CheckboxProps = {
  id?: string;
  label?: string;
  checked: boolean;
  onChangeAction?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};
