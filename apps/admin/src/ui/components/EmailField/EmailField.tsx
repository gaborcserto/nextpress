"use client";

import type { EmailFieldProps } from "./EmailField.types";
import { Input } from "@/ui/primitives";
import type { ChangeEvent } from "react";

export function EmailField({
  id,
  value,
  onChangeAction,
  autoComplete = "email",
  ...rest
}: EmailFieldProps) {
  const handleChangeAction = (e: ChangeEvent<HTMLInputElement>) => {
    onChangeAction(e.target.value);
  };

  return (
    <Input
      {...rest}
      id={id}
      type="email"
      autoComplete={autoComplete}
      value={value}
      onChange={handleChangeAction}
    />
  );
}

export default EmailField;
