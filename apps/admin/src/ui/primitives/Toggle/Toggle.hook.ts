"use client";

import { useId, useState, type ChangeEvent } from "react";

import type { ToggleProps } from "./Toggle.types";

export function useToggle(props: Pick<
  ToggleProps,
  "id" | "checked" | "defaultChecked" | "hint" | "error" | "onChangeAction"
>) {
  const reactId = useId();
  const inputId = props.id ?? `toggle-${reactId}`;

  const isControlled = typeof props.checked === "boolean";

  const [uncontrolledChecked, setUncontrolledChecked] = useState<boolean>(
    props.defaultChecked ?? false
  );

  const currentChecked = isControlled ? (props.checked as boolean) : uncontrolledChecked;

  const describedBy = props.error
    ? `${inputId}-error`
    : props.hint
      ? `${inputId}-hint`
      : undefined;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;

    if (!isControlled) setUncontrolledChecked(next);
    props.onChangeAction?.(next, e);
  };

  return { inputId, currentChecked, describedBy, handleChange };
}
