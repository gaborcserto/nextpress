"use client";

import { SlateEditor, EMPTY_SLATE_VALUE } from "@/ui/components/SlateEditor";
import { Field } from "@/ui/primitives";

import type { PostIntroFieldsProps } from "./PostIntroFields.types";

export function PostIntroFields({
  disabled,
  excerpt,
  onExcerptChangeAction,
}: PostIntroFieldsProps) {
  return (
    <Field
      label="Excerpt (lead)"
      hint="Short intro used on listing pages and social previews."
    >
      <SlateEditor
        compact
        readOnly={disabled}
        label="Excerpt (lead)"
        value={excerpt ?? EMPTY_SLATE_VALUE}
        onChangeAction={onExcerptChangeAction}
      />
    </Field>
  );
}
