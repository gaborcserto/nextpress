export type PasswordFieldProps = {
  id: string;
  value: string;
  onChangeAction: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
};
