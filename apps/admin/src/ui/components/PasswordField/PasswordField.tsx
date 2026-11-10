"use client";

import { Input } from "@/ui/primitives";

import type { ChangeEvent } from "react";

import type { PasswordFieldProps } from "./PasswordField.types";

export function PasswordField({
  id,
  value,
  onChangeAction,
  autoComplete = "current-password",
  ...rest
}: PasswordFieldProps) {
  const handleChangeAction = (e: ChangeEvent<HTMLInputElement>) => {
    onChangeAction(e.target.value);
  };

  return (
    <Input
      {...rest}
      id={id}
      type="password"
      value={value}
      onChange={handleChangeAction}
      autoComplete={autoComplete}
    />
  );
}

export default PasswordField;
