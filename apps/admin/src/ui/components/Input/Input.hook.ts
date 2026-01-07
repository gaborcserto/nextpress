"use client";

import { useId, useState, type ChangeEvent } from "react";

import type { InputProps } from "./Input.types";

type UseInputArgs = Pick<InputProps, "id" | "value" | "type" | "onChange">;

export function useInput({ id, value, type, onChange }: UseInputArgs) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const [internalValue, setInternalValue] = useState(
    (value as string | undefined) ?? ""
  );

  const isControlled = value !== undefined;
  const currentValue = isControlled ? (value as string) : internalValue;

  const [showPassword, setShowPassword] = useState(false);
  const isPassword = (type ?? "text") === "password";
  const actualType = isPassword ? (showPassword ? "text" : "password") : type ?? "text";

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setInternalValue(e.target.value);
    }
    onChange?.(e);
  };

  const clear = () => {
    if (!isControlled) {
      setInternalValue("");
    }

    const synthetic: ChangeEvent<HTMLInputElement> = {
      target: { value: "" } as HTMLInputElement,
    } as ChangeEvent<HTMLInputElement>;

    onChange?.(synthetic);
  };

  return {
    inputId,
    currentValue,
    isPassword,
    actualType,
    showPassword,
    setShowPassword,
    handleChange,
    clear,
  };
}
