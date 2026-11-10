"use client";

import { Input } from "@/ui/primitives";

import type { ChangeEvent } from "react";

import type { RedirectFieldProps } from "./RedirectField.types";

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
      label="Redirect URL"
      type="url"
      fullWidth
      placeholder="https://target-url.com"
      value={value ?? ""}
      onChange={handleChange}
      clearable
    />
  );
}
