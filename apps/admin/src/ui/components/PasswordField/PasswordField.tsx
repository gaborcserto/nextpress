"use client";

import type { PasswordFieldProps } from "./PasswordField.types";
import Input from "@/ui/components/Input";
import type { ChangeEvent } from "react";

/**
 * Password field using the shared <Input> component.
 * Uses Input's built-in password visibility toggle.
 */
export function PasswordField({
  id,
  value,
  onChangeAction,
  label = "Password",
  placeholder = "Your password…",
  required = true,
  autoComplete = "current-password",
}: PasswordFieldProps) {
  const handleChangeAction = (e: ChangeEvent<HTMLInputElement>) => {
    onChangeAction(e.target.value);
  };

  return (
    <Input
      id={id}
      type="password"
      label={label}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      value={value}
      onChange={handleChangeAction}
    />
  );
}

export default PasswordField;
