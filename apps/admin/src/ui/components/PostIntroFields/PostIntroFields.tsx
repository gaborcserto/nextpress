"use client";

import { useAdminLocale } from "@/lib/i18n/admin-locale";
import { SlateEditor, EMPTY_SLATE_VALUE } from "@/ui/components/SlateEditor";
import { Field } from "@/ui/primitives";

import type { PostIntroFieldsProps } from "./PostIntroFields.types";

export function PostIntroFields({
  disabled,
  excerpt,
  onExcerptChangeAction,
}: PostIntroFieldsProps) {
  const label = useAdminLocale() === "hu" ? "Kivonat" : "Excerpt";

  return (
    <Field>
      <SlateEditor
        compact
        readOnly={disabled}
        label={label}
        value={excerpt ?? EMPTY_SLATE_VALUE}
        onChangeAction={onExcerptChangeAction}
      />
    </Field>
  );
}
