export type EmailFieldProps = {
  id: string;
  value: string;
  onChangeAction: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
};
