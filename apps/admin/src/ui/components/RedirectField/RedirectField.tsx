"use client";

import type { RedirectFieldProps } from "./RedirectField.types";
import Input from "@/ui/components/Input";
import type { ChangeEvent } from "react";

/**
 * Simple URL field used for redirect target.
 * Uses the shared <Input> component for consistent styling & ARIA.
 */
export default function RedirectField({
  value,
  onChangeAction,
}: RedirectFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    onChangeAction(raw ? raw : null);
  };

  return (
    <Input
      type="url"
      fullWidth
      placeholder="https://target-url.com"
      value={value ?? ""}
      onChange={handleChange}
      clearable
    />
  );
}
