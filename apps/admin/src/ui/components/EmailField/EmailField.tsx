"use client";

import type { EmailFieldProps } from "./EmailField.types";
import Input from "@/ui/components/Input";
import type { ChangeEvent } from "react";

export function EmailField({
  id,
  value,
  onChangeAction,
  label = "E-Mail Address",
  placeholder = "Enter your email…",
  required = true,
autoComplete = "email",
}: EmailFieldProps) {
  const handleChangeAction = (e: ChangeEvent<HTMLInputElement>) => {
    onChangeAction(e.target.value);
  };

  return (
    <Input
      id={id}
      type="email"
      label={label}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      value={value}
      onChange={handleChangeAction}
    />
  );
}

export default EmailField;
